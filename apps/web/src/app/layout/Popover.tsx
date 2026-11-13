import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../../shared/i18n/I18nProvider';

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** Nút mở popover (do nơi dùng điều khiển open). */
  trigger: ReactNode;
  label: string;
  /** Vị trí của hộp so với nút, ví dụ "bottom-full mb-2 left-0". */
  panelClassName?: string;
  className?: string;
  children: ReactNode;
};

/** Popover dùng chung: bấm ra ngoài hoặc nhấn Esc thì đóng. */
export function Popover({
  open,
  onClose,
  trigger,
  label,
  panelClassName = 'top-full mt-2 left-0',
  className = '',
  children,
}: PopoverProps) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) onCloseRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // preventDefault báo cho SheetPanel biết Esc này đã dùng để đóng popover.
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${className}`}>
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-label={t(label)}
          className={`absolute z-50 animate-pop rounded-2xl bg-white/95 p-3 shadow-glass ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-glass-dark dark:ring-white/10 ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
