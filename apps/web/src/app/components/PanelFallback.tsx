/** Thẻ nhỏ hiển thị trong lúc panel (lazy) đang tải mã. */
export function PanelFallback({ label }: { label: string }) {
  return (
    <div
      className="absolute left-5 top-[143px] z-30 rounded-xl bg-white px-4 py-3 text-xs font-medium text-slate-600 shadow-float max-md:bottom-3 max-md:left-3 max-md:top-auto"
      role="status"
    >
      {label}
    </div>
  );
}
