import { useState } from 'react';
import { Icon } from '../../../shared/components/Icon';
import type { TrafficSeverity } from '../../map/layers/trafficMapLayer';
import type { RoutePlan } from '../../map/types';
import {
  CONGESTION_COLORS,
  CONGESTION_LABELS,
  congestionShares,
  formatCongestionLength,
  routeCongestionTone,
} from '../../traffic/services/routeCongestion';
import { formatDistanceKm, formatDurationMinutes } from '../utils/format';
import { InstructionList } from './InstructionList';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type RouteOptionCardProps = {
  route: RoutePlan;
  /** Nhãn như "Nhanh nhất", "Ngắn nhất", "Tránh trạm thu phí". */
  labels: string[];
  /** Số phút chậm hơn phương án nhanh nhất (0 nếu chính là phương án nhanh nhất). */
  deltaMinutes: number;
  /** Thời gian dài nhất trong các phương án, để vẽ thanh mini-timeline theo tỉ lệ. */
  maxDurationMin: number;
  severity: TrafficSeverity | null;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
};

/** Tông màu thời gian theo mức sự cố trên tuyến: xanh (thông thoáng), vàng (nhẹ), đỏ (nặng). */
const tones: Record<'none' | TrafficSeverity, { text: string; bar: string }> = {
  none: { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-traffic-fast' },
  low: { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-traffic-moderate' },
  medium: { text: 'text-red-600 dark:text-red-400', bar: 'bg-traffic-slow' },
  high: { text: 'text-red-700 dark:text-red-400', bar: 'bg-traffic-jam' },
};

/** Tông thời gian khi có dữ liệu ùn tắc thật từ VietMap (đè lên tông theo sự cố cộng đồng). */
const congestionTones = {
  green: tones.none,
  amber: tones.low,
  red: tones.medium,
};

/** Tên đường đi nhiều nhất trong các chỉ dẫn, dùng cho dòng "qua …". */
function mainStreet(route: RoutePlan): string | null {
  const totals = new Map<string, number>();
  for (const step of route.legs.flatMap((leg) => leg.instructions ?? [])) {
    const name = step.streetName?.trim();
    if (name) totals.set(name, (totals.get(name) ?? 0) + step.distanceMeters);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const hasFerry = (route: RoutePlan) =>
  route.legs.some((leg) => leg.instructions?.some((step) => /phà/i.test(`${step.text} ${step.streetName}`)));

/** Thẻ một phương án tuyến: dải màu trùng đường trên bản đồ, thời gian theo mức tắc, cảnh báo và chi tiết. */
export function RouteOptionCard({
  route,
  labels,
  deltaMinutes,
  maxDurationMin,
  severity,
  selected,
  onSelect,
  onPreview,
}: RouteOptionCardProps) {
  const { t, language } = useI18n();
  const [showSteps, setShowSteps] = useState(false);
  const congestionTone = routeCongestionTone(route);
  const tone = congestionTone ? congestionTones[congestionTone] : tones[severity ?? 'none'];
  const shares = congestionShares(route);
  const heavyMeters = route.congestion?.heavyMeters ?? 0;
  const street = mainStreet(route);
  const instructions = route.legs.flatMap((leg) => leg.instructions ?? []);
  const toll = route.tollCostVnd;
  const delta = deltaMinutes >= 1 ? t('+{minutes} phút', { minutes: deltaMinutes }) : null;

  return (
    <li
      className={`relative overflow-hidden rounded-3xl ring-1 transition ${selected ? 'bg-brand-50/80 ring-2 ring-brand-500 dark:bg-brand-500/15' : 'bg-white/70 ring-black/10 hover:ring-brand-300 dark:bg-white/5 dark:ring-white/15'}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${selected ? 'bg-gradient-to-b from-brand-700 to-accent-600' : 'bg-[#9d9ccb] dark:bg-slate-600'}`}
        aria-hidden="true"
      />
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="block w-full rounded-3xl py-3 pl-5 pr-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className={`text-lg font-extrabold tracking-tight ${tone.text}`}>
            {formatDurationMinutes(route.durationMin, language)}
          </span>
          <span className="text-sm font-semibold text-ink dark:text-slate-100">
            {formatDistanceKm(route.distanceKm, language)}
          </span>
        </span>
        <span
          className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
          aria-hidden="true"
        >
          <span
            className={`block h-full rounded-full ${tone.bar}`}
            style={{ width: `${Math.max(12, (route.durationMin / maxDurationMin) * 100)}%` }}
          />
        </span>
        {shares.length > 0 && (
          <span
            className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
            role="img"
            aria-label={t('Mức giao thông trên tuyến: {levels}', {
              levels: shares
                .map(
                  ({ level, share }) =>
                    `${Math.round(share * 100)}% ${t(CONGESTION_LABELS[level]).toLowerCase()}`,
                )
                .join(', '),
            })}
          >
            {shares.map(({ level, share }) => (
              <span
                key={level}
                className="block h-full"
                style={{ width: `${share * 100}%`, backgroundColor: CONGESTION_COLORS[level] ?? '#9ca3af' }}
              />
            ))}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold text-white"
            >
              {t(label)}
            </span>
          ))}
          {delta && <span className="text-xs font-medium text-ink-soft dark:text-slate-300">{delta}</span>}
        </span>
        {street && (
          <span className="mt-1 block truncate text-xs text-ink-soft dark:text-slate-300">
            {t('qua {street}', { street })}
          </span>
        )}
        {heavyMeters >= 100 && (
          <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
            <Icon name="traffic" size={13} />
            {t('Kẹt xe {length}', { length: formatCongestionLength(heavyMeters) })}
          </span>
        )}
        {severity && (
          <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Icon name="traffic" size={13} />
            {t('Có sự cố giao thông trên tuyến')}
          </span>
        )}
        {toll !== undefined && toll > 0 && (
          <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Icon name="warning" size={13} />
            {t('Có thu phí ~{amount} ₫', {
              amount: new Intl.NumberFormat(language === 'en' ? 'en-US' : 'vi-VN').format(toll),
            })}
          </span>
        )}
        {toll === 0 && (
          <span className="mt-1 block text-xs text-ink-soft dark:text-slate-400">{t('Không thu phí')}</span>
        )}
        {hasFerry(route) && (
          <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Icon name="warning" size={13} />
            {t('Có đoạn đi phà')}
          </span>
        )}
      </button>
      <div className="flex gap-2 pb-3 pl-5 pr-4">
        {instructions.length > 0 && (
          <button
            type="button"
            aria-expanded={showSteps}
            onClick={() => setShowSteps((current) => !current)}
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:text-brand-200 dark:ring-brand-400/40 dark:hover:bg-brand-500/20"
          >
            {t('Chi tiết')}
            <Icon name="chevron-down" size={13} className={showSteps ? 'rotate-180' : ''} />
          </button>
        )}
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-ink-soft ring-1 ring-black/10 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/10"
        >
          <Icon name="compass" size={13} />
          {t('Xem trước')}
        </button>
      </div>
      {showSteps && (
        <div className="px-3 pb-3">
          <InstructionList instructions={instructions} />
        </div>
      )}
    </li>
  );
}
