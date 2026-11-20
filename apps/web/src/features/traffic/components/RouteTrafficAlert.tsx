import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/Icon';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { formatDistanceKm, formatDurationMinutes } from '../../navigation/utils/format';
import { REROUTE_DECISION_MS, type RouteTrafficAlertState } from '../hooks/useRouteTrafficAlert';

type Props = {
  alert: RouteTrafficAlertState;
  /** Số liệu cộng đồng mới nhất của sự cố (cập nhật theo Realtime). */
  community: { reportCount: number; reporterCount: number; updatedAt: string | null };
  onAccept: () => void;
  onKeep: () => void;
  onClose: () => void;
  /**
   * Thẻ "Đang dẫn đường" đang nằm ở trên cùng (khi mở panel Báo cáo...).
   * Khi đó banner xếp ngay dưới thẻ, theo biến --sheet-top-inset mà NavigationBanner đo,
   * thay vì vị trí cố định — tránh che mất chỉ dẫn rẽ.
   */
  belowNavigationBanner?: boolean;
};

const severityLabels = { low: 'nhẹ', medium: 'vừa', high: 'nặng' } as const;
const severityStyles = {
  low: 'from-amber-500 to-orange-500',
  medium: 'from-orange-500 to-red-500',
  high: 'from-red-600 to-rose-700',
} as const;

/** Banner lớn khi có sự cố trên tuyến + hộp hỏi Có/Không đổi sang đường khác (15 giây). */
export function RouteTrafficAlert({
  alert,
  community,
  onAccept,
  onKeep,
  onClose,
  belowNavigationBanner = false,
}: Props) {
  const { t, language } = useI18n();
  const { incident, offer, decision, distanceAheadMeters } = alert;
  const [now, setNow] = useState(() => Date.now());
  const counting = offer.status === 'ready' && decision === 'pending';
  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [counting]);
  const secondsLeft = offer.status === 'ready' ? Math.max(0, Math.ceil((offer.deadline - now) / 1000)) : 0;
  const progress =
    offer.status === 'ready' ? Math.max(0, Math.min(1, (offer.deadline - now) / REROUTE_DECISION_MS)) : 0;
  const updatedTime = community.updatedAt
    ? new Date(community.updatedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      style={belowNavigationBanner ? { top: 'var(--sheet-top-inset)' } : undefined}
      className="route-alert absolute left-1/2 top-[76px] z-[95] w-[min(440px,calc(100%-24px))] -translate-x-1/2 overflow-hidden rounded-3xl bg-white text-ink shadow-float ring-1 ring-black/10 dark:bg-slate-900 dark:text-white dark:shadow-float-dark dark:ring-white/15 max-md:top-[116px]"
      role="alertdialog"
      aria-live="assertive"
      aria-label={t('Cảnh báo giao thông trên tuyến')}
    >
      <div
        className={`flex items-start gap-3 bg-gradient-to-r ${severityStyles[incident.severity]} px-4 py-3 text-white`}
      >
        <span className="mt-0.5 grid h-9 w-9 shrink-0 animate-pulse place-items-center rounded-full bg-white/20">
          <Icon name="warning" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-snug">
            {t('{incident} trên tuyến của bạn', { incident: t(incident.title) })}
          </p>
          <p className="mt-0.5 text-xs font-medium text-white/90">
            {t('Mức {severity}', { severity: t(severityLabels[incident.severity]) })}
            {distanceAheadMeters !== null &&
              ` · ${t('phía trước {distance}', {
                distance:
                  distanceAheadMeters >= 1000
                    ? `${(distanceAheadMeters / 1000).toFixed(1)} km`
                    : `${Math.max(10, Math.round(distanceAheadMeters / 10) * 10)} m`,
              })}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
          aria-label={t('Đóng cảnh báo')}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="text-[12px] font-medium text-brand-700 dark:text-indigo-300">
          {t('{count} báo cáo trong 30 phút / 75 m từ {reporters} người', {
            count: community.reportCount,
            reporters: community.reporterCount,
          })}
          {updatedTime ? ` · ${t('cập nhật')} ${updatedTime}` : ''}
        </p>

        {offer.status === 'computing' && (
          <p
            className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
            role="status"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            {t('Đang tìm đường khác tránh sự cố…')}
          </p>
        )}

        {offer.status === 'ready' && decision === 'pending' && (
          <div className="mt-3">
            <p className="text-sm font-semibold">
              {t('Có đường khác tránh sự cố: {duration} · {distance}', {
                duration: formatDurationMinutes(offer.plan.durationMin, language === 'en' ? 'en' : 'vi'),
                distance: formatDistanceKm(offer.plan.distanceKm, language === 'en' ? 'en' : 'vi'),
              })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {Math.abs(offer.deltaMin) < 1
                ? t('Thời gian gần bằng tuyến hiện tại (chưa tính thời gian kẹt).')
                : offer.deltaMin < 0
                  ? t('Nhanh hơn khoảng {minutes} phút so với tuyến hiện tại.', {
                      minutes: Math.round(-offer.deltaMin),
                    })
                  : t('Lâu hơn khoảng {minutes} phút nhưng tránh được chỗ sự cố.', {
                      minutes: Math.round(offer.deltaMin),
                    })}
            </p>
            <p className="mt-3 text-sm font-semibold">{t('Đổi sang đường này?')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onAccept}
                className="h-11 rounded-2xl bg-brand-gradient text-sm font-bold text-white shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
              >
                {t('Có, đổi tuyến')}
              </button>
              <button
                type="button"
                onClick={onKeep}
                className="h-11 rounded-2xl bg-slate-100 text-sm font-semibold text-ink-soft transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              >
                {t('Không, giữ tuyến ({seconds}s)', { seconds: secondsLeft })}
              </button>
            </div>
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {decision === 'accepted' && (
          <p
            className="mt-3 flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300"
            role="status"
          >
            <Icon name="check" size={16} /> {t('Đã đổi sang đường tránh sự cố.')}
          </p>
        )}
        {decision === 'kept' && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" role="status">
            {t('Giữ tuyến hiện tại. Hãy chú ý khi đi qua đoạn này.')}
          </p>
        )}
        {decision === 'pending' && offer.status === 'none' && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" role="status">
            {t('Không có đường khác tốt hơn để tránh sự cố. Hãy chú ý khi đi qua đoạn này.')}
          </p>
        )}
        {decision === 'pending' && offer.status === 'clear' && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" role="status">
            {t(
              'Sự cố ở sát tuyến nhưng tuyến của bạn không đi qua đúng chỗ đó. Cứ đi tiếp và chú ý quan sát.',
            )}
          </p>
        )}
        {decision === 'pending' && offer.status === 'error' && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200" role="status">
            {t(offer.message)}
          </p>
        )}
      </div>
    </div>
  );
}
