import { useState } from 'react';
import { Icon } from '../../../shared/ui/Icon';
import type { AreaInsight, TrafficLevel } from '../domain/areaInsight';
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

const ZOOM_IN_MESSAGE = 'Phóng to bản đồ để ước tính giao thông khu vực';

/** Widget "Khu vực này" (desktop/tablet): mức giao thông ước tính và số sự cố; thu gọn được. */
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

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        aria-label={t('Mở rộng thẻ Khu vực này (giao thông ước tính)')}
        className="flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-2 text-xs font-semibold text-ink shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10"
      >
        {t('Khu vực này')}
        {insight.status === 'estimated' && (
          <span className={`h-2 w-2 rounded-full ${levelDot[insight.trafficLevel]}`} aria-hidden="true" />
        )}
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
        <h2 className="text-sm font-bold">{t('Khu vực này')}</h2>
        <button
          type="button"
          onClick={() => toggle(true)}
          aria-label={t('Thu gọn thẻ Khu vực này')}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <Icon name="close" size={15} />
        </button>
      </div>
      {insight.status === 'zoom-in' ? (
        <p className="mt-2.5 flex items-center gap-2 rounded-2xl bg-black/[.04] px-3 py-2.5 text-[13px] text-ink-soft dark:bg-white/5 dark:text-slate-300">
          <Icon name="plus" size={16} className="shrink-0" />
          {t(ZOOM_IN_MESSAGE)}
        </p>
      ) : (
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
      )}
      <p className="mt-2 text-[11px] text-content-subtle">
        {t('Giao thông ước tính từ giờ cao điểm và báo cáo cộng đồng, không phải dữ liệu thời gian thực')}
      </p>
    </section>
  );
}

/** Viên thuốc "Khu vực này" thu gọn cho mobile, nằm phía trên thanh tab. */
export function AreaInsightPill({ insight, onOpenTraffic }: AreaInsightCardProps) {
  const { t } = useI18n();
  if (insight.status === 'zoom-in') {
    return (
      <button
        type="button"
        onClick={onOpenTraffic}
        aria-label={t('{message}. Mở bảng Giao thông', { message: t(ZOOM_IN_MESSAGE) })}
        className={pillClass}
      >
        <Icon name="plus" size={14} />
        {t('Phóng to để xem giao thông')}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpenTraffic}
      aria-label={t(
        'Khu vực này: {traffic} (ước tính từ giờ cao điểm và báo cáo cộng đồng). Mở bảng Giao thông',
        {
          traffic: t(insight.trafficLabel),
        },
      )}
      className={pillClass}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${levelDot[insight.trafficLevel]}`} aria-hidden="true" />
      {t(insight.trafficLabel)}
    </button>
  );
}

const pillClass =
  'flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-3 text-xs font-semibold text-ink shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10';
