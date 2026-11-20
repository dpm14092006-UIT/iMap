import { Icon } from '../../../shared/ui/Icon';
import { PHOTO_TYPES } from '../domain/photoValidation';
export function PhotoPicker({
  label,
  icon,
  capture,
  disabled,
  className,
  onPick,
}: {
  label: string;
  icon: 'camera' | 'upload';
  capture?: boolean;
  disabled: boolean;
  className: string;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <label
      className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition focus-within:ring-4 ${className}`}
    >
      <Icon name={icon} size={icon === 'camera' ? 15 : 14} />
      {label}
      <input
        type="file"
        accept={PHOTO_TYPES}
        {...(capture ? { capture: 'environment' as const } : {})}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </label>
  );
}
