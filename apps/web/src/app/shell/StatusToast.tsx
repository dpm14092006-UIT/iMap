import { Icon } from '../../shared/ui/Icon';

/** Thông báo ngắn nổi phía trên bản đồ. */
export function StatusToast({ message }: { message: string }) {
  return (
    <div
      className="toast-message absolute left-1/2 top-[76px] z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-glass dark:shadow-glass-dark ring-1 ring-white/15 backdrop-blur-xl max-md:top-[116px]"
      role="status"
      aria-live="polite"
    >
      <Icon name="check" size={15} className="shrink-0 text-teal-300" />
      {message}
    </div>
  );
}
