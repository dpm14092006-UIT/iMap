import type { CSSProperties } from 'react';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  /** Hiện nút +/- cả trên điện thoại (lúc dẫn đường để dễ xem trước hành trình). */
  showZoom?: boolean;
  /** Chế độ 3D và hướng/độ nghiêng hiện tại của bản đồ (la bàn chỉ hiện khi bản đồ xoay hoặc nghiêng). */
  view3d?: boolean;
  onToggle3d?: () => void;
  /** 4D: mở/đóng thanh dòng thời gian. */
  timelineOpen?: boolean;
  onToggleTimeline?: () => void;
  camera?: { bearing: number; pitch: number };
  onResetNorth?: () => void;
};

type ControlButtonProps = {
  icon: IconName;
  label: string;
  onClick: () => void;
  className?: string;
  pressed?: boolean;
  iconStyle?: CSSProperties;
};

function ControlButton({ icon, label, onClick, className = '', pressed, iconStyle }: ControlButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(label)}
      aria-pressed={pressed}
      title={t(label)}
      className={`grid h-11 w-11 place-items-center text-ink-soft transition hover:bg-brand-50 hover:text-brand-700 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-95 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white ${className}`}
    >
      <span className="grid place-items-center transition-transform duration-150" style={iconStyle}>
        <Icon name={icon} size={20} />
      </span>
    </button>
  );
}

/** Cụm điều khiển góc dưới phải: định vị, phóng to/thu nhỏ, xem toàn Việt Nam. */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  showZoom = false,
  view3d = false,
  onToggle3d,
  timelineOpen = false,
  onToggleTimeline,
  camera,
  onResetNorth,
}: MapControlsProps) {
  const rotated = camera ? Math.abs(camera.bearing) > 0.5 : false;
  const { t } = useI18n();
  const zoomClass = showZoom ? '' : 'hidden';
  return (
    <div
      className="flex flex-col divide-y divide-black/5 overflow-hidden rounded-xl bg-surface shadow-glass dark:shadow-glass-dark ring-1 ring-line dark:divide-white/10"
      role="group"
      aria-label={t('Điều khiển bản đồ')}
    >
      {(onToggle3d || (rotated && onResetNorth)) &&
        (view3d || rotated ? (
          // Một nút cho cả 3D và la bàn: đang 3D hoặc bản đồ bị xoay thì là la bàn (kim chỉ Bắc);
          // bấm vào thì về hướng Bắc và trở lại 2D, nút lại thành hình khối.
          <ControlButton
            icon="compass"
            label={view3d ? 'Về hướng Bắc, chuyển sang bản đồ 2D' : 'Xoay về hướng Bắc'}
            onClick={() => (view3d && onToggle3d ? onToggle3d() : onResetNorth?.())}
            pressed={view3d}
            className={view3d ? 'text-brand-700 dark:text-brand-200' : ''}
            iconStyle={{ transform: `rotate(${-(camera?.bearing ?? 0) - 45}deg)` }}
          />
        ) : (
          <ControlButton
            icon="cube"
            label="Chuyển sang bản đồ 3D"
            onClick={() => onToggle3d?.()}
            pressed={false}
          />
        ))}
      {onToggleTimeline && (
        <ControlButton
          icon="clock"
          label={timelineOpen ? 'Đóng dòng thời gian' : 'Mở dòng thời gian (4D)'}
          onClick={onToggleTimeline}
          pressed={timelineOpen}
          className={timelineOpen ? 'text-brand-700 dark:text-brand-200' : ''}
        />
      )}
      <ControlButton icon="current-location" label="Định vị vị trí hiện tại" onClick={onLocate} />
      {/* Trên điện thoại đã có thao tác chụm hai ngón nên ẩn nút +/- cho gọn. */}
      <ControlButton icon="plus" label="Phóng to bản đồ" onClick={onZoomIn} className={zoomClass} />
      <ControlButton icon="minus" label="Thu nhỏ bản đồ" onClick={onZoomOut} className={zoomClass} />
    </div>
  );
}
