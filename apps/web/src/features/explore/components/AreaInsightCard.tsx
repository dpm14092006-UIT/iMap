import { useState } from 'react';
import { Icon } from '../../../shared/components/Icon';
import type { AreaInsight, TrafficLevel } from '../services/areaInsight';
import { useI18n } from '../../../shared/i18n/I18nProvider';

const STORAGE_KEY = 'imap.areaInsight.collapsed';

const levelDot: Record<TrafficLevel, string> = {
  smooth: 'bg-traffic-fast',
  moderate: 'bg-traffic-moderate',
  heavy: 'bg-traffic-slow',
};
/** Thanh 3 nấc: số nấc sáng theo mức giao thông. */
const levelSteps: Record<TrafficLevel, number> = { smooth: 1, moderate: 2, heavy: 3 };

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Trình duyệt chặn lưu trữ: bỏ qua, chỉ mất việc nhớ trạng thái.
  }
}

type AreaInsightCardProps = { insight: AreaInsight; onOpenTraffic: () => void };

/** Widget "Khu vực này" (desktop/tablet): thời tiết, mức giao thông và số sự cố; thu gọn được. */
export function AreaInsightCard({ insight, onOpenTraffic }: AreaInsightCardProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = (next: boolean) => {
    setCollapsed(next);
    writeCollapsed(next);
  };
  const trafficHint = t(
    'Mức giao thông là ước tính từ giờ cao điểm và báo cáo cộng đồng, không phải dữ liệu thời gian thực',
  );
  const weather = (
    <span className="flex items-center gap-1 font-semibold">
      <Icon name={insight.weatherIcon} size={16} className="text-amber-500" />
      {insight.temperatureC}°C
      <span className="sr-only">
        {t('Thời tiết minh họa: {weather}', { weather: t(insight.weatherLabel) })}
      </span>
    </span>
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        aria-label={t('Mở rộng thẻ Khu vực này (thời tiết minh họa, giao thông ước tính)')}
        className="flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-2 text-xs text-ink shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10"
      >
        {t('Khu vực này')} · {weather}
        <span className={`h-2 w-2 rounded-full ${levelDot[insight.trafficLevel]}`} aria-hidden="true" />
        <Icon name="chevron-down" size={14} />
      </button>
    );
  }

  return (
    <section
      aria-label={t('Khu vực này')}
      className="animate-fade-in rounded-3xl bg-white/90 p-3.5 text-ink shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          {t('Khu vực này')} <span className="text-ink-soft dark:text-slate-400">·</span> {weather}
        </h2>
        <button
          type="button"
          onClick={() => toggle(true)}
          aria-label={t('Thu gọn thẻ Khu vực này')}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <Icon name="close" size={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpenTraffic}
        title={trafficHint}
        className="group mt-2.5 flex w-full items-center gap-3 rounded-2xl bg-black/[.04] px-3 py-2.5 text-left transition hover:bg-black/[.07] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <span className="flex gap-0.5" aria-hidden="true">
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={`h-5 w-1.5 rounded-full ${step <= levelSteps[insight.trafficLevel] ? levelDot[insight.trafficLevel] : 'bg-slate-300 dark:bg-slate-600'}`}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">{t(insight.trafficLabel)}</span>
          <span className="block text-xs text-ink-soft dark:text-slate-400">
            {insight.delayMinutes > 0
              ? t('Có thể chậm hơn ~{minutes} phút', { minutes: insight.delayMinutes })
              : t('Chưa thấy dấu hiệu chậm hơn')}
            {' · '}
            {insight.incidentCount > 0
              ? t('{count} sự cố đang báo', { count: insight.incidentCount })
              : t('Chưa có sự cố')}
          </span>
        </span>
        <Icon
          name="chevron-right"
          size={17}
          className="shrink-0 text-ink-soft transition group-hover:translate-x-0.5 dark:text-slate-400"
        />
        <span className="sr-only">{t('Mở bảng Giao thông')}</span>
      </button>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        {t('Thời tiết minh họa · Giao thông ước tính từ giờ cao điểm và báo cáo cộng đồng')}
      </p>
    </section>
  );
}

/** Viên thuốc "Khu vực này" thu gọn cho mobile, nằm phía trên thanh tab. */
export function AreaInsightPill({ insight, onOpenTraffic }: AreaInsightCardProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpenTraffic}
      aria-label={t(
        'Khu vực này: {temperature} độ (thời tiết minh họa), {traffic} (ước tính từ giờ cao điểm và báo cáo cộng đồng). Mở bảng Giao thông',
        {
          temperature: insight.temperatureC,
          traffic: t(insight.trafficLabel),
        },
      )}
      className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-3 text-xs font-semibold text-ink shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10"
    >
      <Icon name={insight.weatherIcon} size={16} className="text-amber-500" />
      {insight.temperatureC}°C
      <span className={`h-2.5 w-2.5 rounded-full ${levelDot[insight.trafficLevel]}`} aria-hidden="true" />
      {/* "≈" giữ ý "ước tính" mà vẫn vừa một hàng với nút Lớp và chú giải. */}≈{' '}
      {t(insight.trafficLabel)
        .replace(/^(Ước tính: |Estimated: )/, '')
        .replace(/^./, (c) => c.toUpperCase())}
    </button>
  );
}
