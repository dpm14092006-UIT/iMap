/** Thẻ nhỏ hiển thị trong lúc panel (lazy) đang tải mã. */
export function PanelFallback({ label }: { label: string }) {
  return (
    <div
      className="absolute z-30 animate-fade-in rounded-2xl bg-white/90 px-4 py-3 text-xs font-medium text-ink-soft shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl dark:bg-slate-900/90 dark:text-slate-200 dark:ring-white/10 max-md:inset-x-0 max-md:bottom-[var(--tab-h)] max-md:rounded-b-none max-md:rounded-t-3xl max-md:px-5 max-md:py-6 max-md:text-center md:left-[80px] md:top-[72px] lg:left-[88px]"
      role="status"
    >
      {label}
    </div>
  );
}
