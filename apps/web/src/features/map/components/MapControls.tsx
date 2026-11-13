import { Icon, type IconName } from '../../../shared/components/Icon';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  onShowVietnam: () => void;
  /** Hiện nút +/- cả trên điện thoại (lúc dẫn đường để dễ xem trước hành trình). */
  showZoom?: boolean;
};

type ControlButtonProps = { icon: IconName; label: string; onClick: () => void; className?: string };

function ControlButton({ icon, label, onClick, className = '' }: ControlButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(label)}
      title={t(label)}
      className={`grid h-11 w-11 max-md:h-10 max-md:w-10 place-items-center text-ink-soft transition hover:bg-brand-50 hover:text-brand-700 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-95 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white ${className}`}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/** Cụm điều khiển góc dưới phải: định vị, phóng to/thu nhỏ, xem toàn Việt Nam. */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  onShowVietnam,
  showZoom = false,
}: MapControlsProps) {
  const { t } = useI18n();
  const zoomClass = showZoom ? '' : 'max-md:hidden';
  return (
    <div
      className="flex flex-col divide-y divide-black/5 overflow-hidden rounded-2xl bg-white/90 shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl dark:divide-white/10 dark:bg-slate-900/85 dark:ring-white/10"
      role="group"
      aria-label={t('Điều khiển bản đồ')}
    >
      <ControlButton icon="current-location" label="Định vị vị trí hiện tại" onClick={onLocate} />
      {/* Trên điện thoại đã có thao tác chụm hai ngón nên ẩn nút +/- cho gọn. */}
      <ControlButton icon="plus" label="Phóng to bản đồ" onClick={onZoomIn} className={zoomClass} />
      <ControlButton icon="minus" label="Thu nhỏ bản đồ" onClick={onZoomOut} className={zoomClass} />
      <ControlButton icon="globe" label="Xem toàn Việt Nam" onClick={onShowVietnam} />
    </div>
  );
}
