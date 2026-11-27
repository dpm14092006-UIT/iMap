import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatClock, formatDistanceMeters, formatDurationMinutes } from '../../../shared/format/units';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { Icon } from '../../../shared/ui/Icon';
import { useShell } from '../../../shared/ui/shell';
import { formatInstructionText, maneuverArrow } from '../../routing/domain/maneuver';
import type { NavigationStatus } from '../types';

type NavigationBannerProps = {
  status: NavigationStatus;
  instruction: { text: string; sign?: number } | null;
  distanceToInstructionMeters: number;
  distanceRemainingMeters: number;
  /** Thời gian còn lại (giây) ước tính từ vị trí GPS trên tuyến; null khi chưa có. */
  remainingSeconds?: number | null;
  offRoute: boolean;
  error: string;
  canRecalculate: boolean;
  isRecalculating: boolean;
  onRecalculate: () => void;
  onRetry: () => void;
  onReport: () => void;
  onStop: () => void;
  audio?: { enabled: boolean; supported: boolean; toggle: () => void };
  /** Người dùng đang tự kéo / zoom xem trước, bản đồ không bám vị trí. */
  followPaused?: boolean;
  /** Bám lại vị trí hiện tại. */
  onRecenter?: () => void;
  /** Zoom vừa toàn tuyến để xem trước hành trình. */
  onPreviewRoute?: () => void;
  /** Đang mở bảng khác (vd. Báo cáo) ở đáy màn hình: banner lên đỉnh để không chồng nhau. */
  atTop?: boolean;
};

const statusLabels: Partial<Record<NavigationStatus, string>> = {
  locating: 'ĐANG TÌM GPS',
  navigating: 'ĐANG DẪN ĐƯỜNG',
  arrived: 'ĐÃ ĐẾN NƠI',
  error: 'MẤT TÍN HIỆU GPS',
};

/** Chỉ dẫn trực tiếp và các thao tác chuyến đi luôn hiển thị trên bản đồ. */
export function NavigationBanner({
  status,
  instruction,
  distanceToInstructionMeters,
  distanceRemainingMeters,
  remainingSeconds = null,
  offRoute,
  error,
  canRecalculate,
  isRecalculating,
  onRecalculate,
  onRetry,
  onReport,
  onStop,
  audio,
  followPaused = false,
  onRecenter,
  onPreviewRoute,
  atTop = false,
}: NavigationBannerProps) {
  // Giờ đến = bây giờ + thời gian còn lại: cập nhật mỗi lần GPS báo vị trí và mỗi 30 giây (kể cả khi đứng yên vì kẹt xe).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (remainingSeconds === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds]);
  const { language, t } = useI18n();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { setSheet, setTopOverlayInset } = useShell();
  const root = useRef<HTMLElement>(null);
  const visible = status !== 'idle';
  const reportsHeight = visible && isMobile && !atTop;

  // Điện thoại: báo chiều cao banner (như bảng kéo) để nút bản đồ và khung zoom tuyến né lên trên.
  useEffect(() => {
    const element = root.current;
    if (!reportsHeight || !element) return;
    const measure = () => {
      const bottom = element.offsetHeight + 12;
      setSheet({ height: `${bottom}px`, isFull: false, inset: { left: 0, bottom } });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      setSheet({ height: null, isFull: false, inset: null });
    };
  }, [reportsHeight, setSheet]);

  useLayoutEffect(() => {
    const element = root.current;
    if (!visible || !atTop || !element) {
      setTopOverlayInset(null);
      return;
    }
    const measure = () => setTopOverlayInset(element.offsetHeight + 24);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      setTopOverlayInset(null);
    };
  }, [visible, atTop, setTopOverlayInset]);

  if (!visible) return null;

  const isGuiding = status === 'navigating' || status === 'locating';
  /**
   * Khi có nút tính lại hoặc thử lại GPS, ưu tiên chỗ cho thao tác chính trong banner.
   * Các nút rút gọn vẫn có tên cho trình đọc màn hình và tooltip.
   */
  const compactSecondary = offRoute || status === 'error';
  const secondaryLabelClass = compactSecondary ? 'sr-only' : undefined;
  const previewLabel = t(followPaused ? 'Về vị trí' : 'Toàn tuyến');
  const stopLabel = t(status === 'arrived' ? 'Đóng' : 'Kết thúc');
  const instructionText = instruction
    ? formatInstructionText(instruction, language)
    : t('Tiếp tục theo tuyến đường');

  return (
    <section
      ref={root}
      data-nav-banner=""
      className={`absolute left-3 right-3 z-50 animate-fade-in overflow-hidden rounded-xl ${atTop ? 'top-3' : 'bottom-[calc(12px+env(safe-area-inset-bottom))]'} bg-brand-800 text-white shadow-glass dark:shadow-glass-dark ring-1 ring-white/15 md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2`}
      aria-label={t('Điều hướng chuyến đi')}
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-[.1em] ${offRoute ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/80'}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${offRoute ? 'bg-amber-400' : status === 'arrived' ? 'bg-brand-200' : 'bg-brand-300'}`}
        />
        {offRoute ? t('ĐANG LỆCH KHỎI TUYẾN') : statusLabels[status] ? t(statusLabels[status]!) : ''}
        {audio && (
          <button
            type="button"
            onClick={audio.toggle}
            aria-pressed={audio.enabled}
            aria-label={t(
              audio.enabled ? 'Tắt âm thanh chỉ đường và cảnh báo' : 'Bật âm thanh chỉ đường và cảnh báo',
            )}
            title={t(
              audio.supported ? 'Âm thanh chỉ đường và cảnh báo' : 'Thiết bị chỉ hỗ trợ chuông cảnh báo',
            )}
            className="ml-auto flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
          >
            <Icon name={audio.enabled ? 'volume' : 'volume-off'} size={16} />
            <span className="max-md:hidden">{t(audio.enabled ? 'Âm thanh' : 'Tắt tiếng')}</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        {isGuiding && (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
            <span className="text-[38px] leading-none" aria-hidden="true">
              {maneuverArrow(instruction?.sign)}
            </span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold leading-6">
            {offRoute
              ? t('Bạn đang rời khỏi lộ trình')
              : status === 'arrived'
                ? t('Chuyến đi đã hoàn tất')
                : status === 'error'
                  ? t(error)
                  : status === 'locating'
                    ? t('Đang lấy vị trí GPS…')
                    : instructionText}
          </p>
          {isGuiding && !offRoute && status === 'navigating' && (
            <p className="mt-1 text-sm font-semibold text-brand-200">
              {distanceToInstructionMeters > 0
                ? t('Trong {distance}', {
                    distance: formatDistanceMeters(distanceToInstructionMeters, language),
                  })
                : t('Thực hiện chỉ dẫn tiếp theo')}
            </p>
          )}
          {isGuiding && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {!offRoute && (
                <p className="text-xs text-white/70" data-testid="navigation-eta">
                  {remainingSeconds !== null && (
                    <>
                      <span className="font-semibold text-white">
                        {t('Đến lúc {time}', {
                          time: formatClock(new Date(now + remainingSeconds * 1000), language),
                        })}
                      </span>{' '}
                      · {formatDurationMinutes(remainingSeconds / 60, language)} ·{' '}
                    </>
                  )}
                  {t('Còn {distance}', { distance: formatDistanceMeters(distanceRemainingMeters, language) })}{' '}
                  · {t('GPS trực tiếp')}
                </p>
              )}
            </div>
          )}
          {error && status !== 'error' && <p className="mt-1 text-xs text-amber-200">{t(error)}</p>}
          {offRoute && (
            <p className="mt-1 text-xs leading-4 text-white/70">
              {t('Vị trí GPS đang cách xa tuyến. Tính lại từ vị trí hiện tại để tiếp tục.')}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-2 py-2.5">
        {(offRoute || status === 'error') && (
          <button
            type="button"
            onClick={offRoute ? onRecalculate : onRetry}
            disabled={offRoute ? !canRecalculate || isRecalculating : false}
            className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-surface px-2 text-xs font-bold text-brand-800 dark:text-brand-200 transition hover:bg-brand-50 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 disabled:bg-white/40 dark:disabled:bg-slate-800/30"
          >
            {isRecalculating ? (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
            ) : (
              <Icon name="route" size={14} />
            )}
            {/* Co được và cắt "…" thay vì đẩy cả hàng nút xuống dòng trên màn hình 320px. */}
            <span className="min-w-0 truncate">
              {t(isRecalculating ? 'Đang tính lại…' : offRoute ? 'Tính lại tuyến' : 'Thử lại GPS')}
            </span>
          </button>
        )}
        {isGuiding && (followPaused ? onRecenter : onPreviewRoute) && (
          <button
            type="button"
            onClick={followPaused ? onRecenter : onPreviewRoute}
            title={previewLabel}
            className={`flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${followPaused ? 'bg-teal-300 text-slate-900 hover:bg-teal-200' : 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20'}`}
          >
            <Icon name={followPaused ? 'current-location' : 'route'} size={15} />
            <span className={secondaryLabelClass}>{previewLabel}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onReport}
          title={t('Báo cáo')}
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-amber-400/20 px-2 text-xs font-bold text-amber-100 ring-1 ring-amber-300/40 transition hover:bg-amber-400/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
        >
          <Icon name="traffic" size={15} />
          <span className={secondaryLabelClass}>{t('Báo cáo')}</span>
        </button>
        <button
          type="button"
          onClick={onStop}
          title={stopLabel}
          className={`flex min-h-10 min-w-10 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-white/10 px-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${compactSecondary ? 'max-[359px]:flex-none' : ''}`}
        >
          <Icon name="close" size={14} />
          <span className={compactSecondary ? 'max-[359px]:sr-only' : undefined}>{stopLabel}</span>
          <span className="max-md:hidden">{t('chuyến đi')}</span>
        </button>
      </div>
    </section>
  );
}
