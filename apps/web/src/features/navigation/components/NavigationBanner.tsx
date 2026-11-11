import { Icon } from '../../../shared/components/Icon';
import type { NavigationStatus } from '../hooks/useNavigationSession';
import { formatDistanceMeters } from '../utils/format';
import { maneuverArrow } from '../utils/maneuver';

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
  onStop: () => void;
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
  offRoute,
  error,
  canRecalculate,
  isRecalculating,
  onRecalculate,
  onRetry,
  onStop,
}: NavigationBannerProps) {
  if (status === 'idle') return null;

  const isGuiding = status === 'navigating' || status === 'locating';
  const instructionText = instruction?.text || 'Tiếp tục theo tuyến đường';

  return (
    <section
      className="absolute right-5 top-[136px] z-50 w-[min(370px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl shadow-slate-900/15 backdrop-blur-xl max-md:left-3 max-md:right-3 max-md:top-[120px] max-md:w-auto"
      aria-label="Điều hướng chuyến đi"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 text-[9px] font-bold tracking-[.1em] ${offRoute ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-700'}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${offRoute ? 'bg-amber-500' : status === 'arrived' ? 'bg-emerald-500' : 'animate-pulse bg-brand-600'}`}
        />
        {offRoute ? 'ĐANG LỆCH KHỎI TUYẾN' : statusLabels[status]}
      </div>
      <div className="flex items-start gap-3 p-4">
        {isGuiding && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
            <span className="text-[24px] leading-none" aria-hidden="true">
              {maneuverArrow(instruction?.sign)}
            </span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-5 text-ink">
            {offRoute
              ? 'Bạn đang rời khỏi lộ trình'
              : status === 'arrived'
                ? 'Chuyến đi đã hoàn tất'
                : status === 'error'
                  ? error
                  : status === 'locating'
                    ? 'Đang lấy vị trí GPS…'
                    : instructionText}
          </p>
          {isGuiding && !offRoute && status === 'navigating' && (
            <p className="mt-1 text-[11px] font-semibold text-brand-700">
              {distanceToInstructionMeters > 0
                ? `Trong ${formatDistanceMeters(distanceToInstructionMeters)}`
                : 'Thực hiện chỉ dẫn tiếp theo'}
            </p>
          )}
          {isGuiding && !offRoute && (
            <p className="mt-1 text-[10px] text-slate-500">
              Còn {formatDistanceMeters(distanceRemainingMeters)} · GPS đang cập nhật trực tiếp
            </p>
          )}
          {error && status !== 'error' && <p className="mt-1 text-[10px] text-amber-800">{error}</p>}
          {offRoute && (
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              Vị trí GPS đang cách xa tuyến. Tính lại từ vị trí hiện tại để tiếp tục.
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
        {(offRoute || status === 'error') && (
          <button
            type="button"
            onClick={offRoute ? onRecalculate : onRetry}
            disabled={offRoute ? !canRecalculate || isRecalculating : false}
            className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 text-[11px] font-bold text-white transition hover:bg-brand-700 disabled:bg-slate-300"
          >
            {isRecalculating ? (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
            ) : (
              <Icon name="route" size={14} />
            )}
            {isRecalculating ? 'Đang tính lại…' : offRoute ? 'Tính lại tuyến' : 'Thử lại GPS'}
          </button>
        )}
        <button
          type="button"
          onClick={onStop}
          className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Icon name="close" size={14} />
          {status === 'arrived' ? 'Đóng chuyến đi' : 'Kết thúc chuyến đi'}
        </button>
      </div>
    </section>
  );
}
