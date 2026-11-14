import { useEffect, useLayoutEffect, useRef } from 'react';
import { useShell } from '../../../app/layout/AppShell';
import { Icon } from '../../../shared/components/Icon';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import type { NavigationMode } from '../domain/position/PositionSource';
import type { NavigationStatus } from '../hooks/useNavigationSession';
import { formatDistanceMeters } from '../utils/format';
import { formatInstructionText, maneuverArrow } from '../utils/maneuver';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type NavigationBannerProps = {
  status: NavigationStatus;
  instruction: { text: string; sign?: number } | null;
  distanceToInstructionMeters: number;
  distanceRemainingMeters: number;
  offRoute: boolean;
  error: string;
  canRecalculate: boolean;
  isRecalculating: boolean;
  onRecalculate: () => void;
  onRetry: () => void;
  onReport: () => void;
  onStop: () => void;
  /** Chế độ Demo (GPS giả) chỉ có khi mở app với ?demo=1. Không truyền thì banner như cũ. */
  demo?: DemoControls;
  /** Người dùng đang tự kéo / zoom xem trước, bản đồ không bám vị trí. */
  followPaused?: boolean;
  /** Bám lại vị trí hiện tại. */
  onRecenter?: () => void;
  /** Zoom vừa toàn tuyến để xem trước hành trình. */
  onPreviewRoute?: () => void;
  /** Đang mở bảng khác (vd. Báo cáo) ở đáy màn hình: banner lên đỉnh để không chồng nhau. */
  atTop?: boolean;
};

/** Điều khiển chế độ Thật / Demo trên banner. */
export type DemoControls = {
  mode: NavigationMode;
  isPaused: boolean;
  onModeChange: (mode: NavigationMode) => void;
  onTogglePause: () => void;
  onWrongTurn: () => void;
  onIncidentAhead: () => void;
};

const modeOptions: { id: NavigationMode; label: string }[] = [
  { id: 'real', label: 'Thật' },
  { id: 'demo', label: 'Demo' },
];

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
  offRoute,
  error,
  canRecalculate,
  isRecalculating,
  onRecalculate,
  onRetry,
  onReport,
  onStop,
  demo,
  followPaused = false,
  onRecenter,
  onPreviewRoute,
  atTop = false,
}: NavigationBannerProps) {
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
  const instructionText = instruction
    ? formatInstructionText(instruction, language)
    : t('Tiếp tục theo tuyến đường');

  return (
    <section
      ref={root}
      data-nav-banner=""
      className={`absolute left-3 right-3 z-50 animate-fade-in overflow-hidden rounded-3xl ${atTop ? 'top-3' : 'bottom-[calc(12px+env(safe-area-inset-bottom))]'} bg-gradient-to-br from-slate-900 via-indigo-950 to-teal-900 text-white shadow-glass dark:shadow-glass-dark ring-1 ring-white/15 md:right-auto md:w-[420px]`}
      aria-label={t('Điều hướng chuyến đi')}
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-[.1em] ${offRoute ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/80'}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${offRoute ? 'bg-amber-400' : status === 'arrived' ? 'bg-emerald-400' : 'animate-pulse bg-teal-300'}`}
        />
        {offRoute ? t('ĐANG LỆCH KHỎI TUYẾN') : statusLabels[status] ? t(statusLabels[status]!) : ''}
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
            <p className="mt-1 text-sm font-semibold text-teal-200">
              {distanceToInstructionMeters > 0
                ? t('Trong {distance}', {
                    distance: formatDistanceMeters(distanceToInstructionMeters, language),
                  })
                : t('Thực hiện chỉ dẫn tiếp theo')}
            </p>
          )}
          {isGuiding && !offRoute && (
            <p className="mt-1 text-xs text-white/70">
              {t('Còn {distance}', { distance: formatDistanceMeters(distanceRemainingMeters, language) })} ·{' '}
              {t(demo?.mode === 'demo' ? 'GPS giả lập (demo)' : 'GPS trực tiếp')}
            </p>
          )}
          {error && status !== 'error' && <p className="mt-1 text-xs text-amber-200">{t(error)}</p>}
          {offRoute && (
            <p className="mt-1 text-xs leading-4 text-white/70">
              {t('Vị trí GPS đang cách xa tuyến. Tính lại từ vị trí hiện tại để tiếp tục.')}
            </p>
          )}
        </div>
      </div>
      {demo && (
        <div className="space-y-2 border-t border-white/10 bg-black/15 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[.08em] text-white/60">
              {t('Nguồn vị trí')}
            </span>
            <div
              className="flex rounded-lg bg-white/10 p-0.5"
              role="group"
              aria-label={t('Chế độ dẫn đường')}
            >
              {modeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={demo.mode === option.id}
                  onClick={() => demo.onModeChange(option.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${demo.mode === option.id ? 'bg-white text-indigo-700' : 'text-white/70 hover:text-white'}`}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
          </div>
          {demo.mode === 'demo' && isGuiding && (
            <div className="flex flex-wrap gap-1.5">
              <DemoButton
                label={t(demo.isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng')}
                onClick={demo.onTogglePause}
              />
              <DemoButton label={t('↪ Rẽ nhầm')} onClick={demo.onWrongTurn} />
              <DemoButton label={t('⚠ Sự cố phía trước')} onClick={demo.onIncidentAhead} />
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 border-t border-white/10 px-3 py-2.5">
        {(offRoute || status === 'error') && (
          <button
            type="button"
            onClick={offRoute ? onRecalculate : onRetry}
            disabled={offRoute ? !canRecalculate || isRecalculating : false}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white dark:bg-slate-800/60 px-3 text-xs font-bold text-indigo-900 dark:text-indigo-200 transition hover:bg-indigo-50 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 disabled:bg-white/40 dark:disabled:bg-slate-800/30"
          >
            {isRecalculating ? (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
            ) : (
              <Icon name="route" size={14} />
            )}
            {t(isRecalculating ? 'Đang tính lại…' : offRoute ? 'Tính lại tuyến' : 'Thử lại GPS')}
          </button>
        )}
        {isGuiding && (followPaused ? onRecenter : onPreviewRoute) && (
          <button
            type="button"
            onClick={followPaused ? onRecenter : onPreviewRoute}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 ${followPaused ? 'bg-teal-300 text-slate-900 hover:bg-teal-200' : 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20'}`}
          >
            <Icon name={followPaused ? 'current-location' : 'route'} size={15} />
            {t(followPaused ? 'Về vị trí' : 'Toàn tuyến')}
          </button>
        )}
        <button
          type="button"
          onClick={onReport}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-amber-400/20 px-3 text-xs font-bold text-amber-100 ring-1 ring-amber-300/40 transition hover:bg-amber-400/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
        >
          <Icon name="traffic" size={15} />
          {t('Báo cáo')}
        </button>
        <button
          type="button"
          onClick={onStop}
          className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          <Icon name="close" size={14} />
          {t(status === 'arrived' ? 'Đóng' : 'Kết thúc')}
          <span className="max-md:hidden">{t('chuyến đi')}</span>
        </button>
      </div>
    </section>
  );
}

/** Nút nhỏ cho các thao tác của chế độ Demo. */
function DemoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-lg border border-white/15 bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {label}
    </button>
  );
}
