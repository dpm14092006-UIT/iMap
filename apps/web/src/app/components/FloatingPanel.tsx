import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../shared/components/Icon';

type FloatingPanelProps = {
  title: string;
  eyebrow: string;
  icon: IconName;
  onClose: () => void;
  children: ReactNode;
};

export function FloatingPanel({ title, eyebrow, icon, onClose, children }: FloatingPanelProps) {
  return (
    <section
      className="floating-panel absolute left-5 top-[143px] z-30 flex max-h-[calc(100dvh-166px)] w-[min(394px,calc(100vw-40px))] flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-float max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[56dvh] max-md:w-full max-md:rounded-b-none max-md:rounded-t-[23px] max-md:pb-[env(safe-area-inset-bottom)]"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-3 sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-brand-50 text-brand-600">
          <Icon name={icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="sr-only">{eyebrow}</p>
          <h2 className="truncate text-[16px] font-bold tracking-[-.02em] text-ink">{title}</h2>
        </div>
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          type="button"
          aria-label="Đóng bảng"
          onClick={onClose}
        >
          <Icon name="close" size={19} />
        </button>
      </header>
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-5 sm:py-[18px]">
        {children}
      </div>
    </section>
  );
}
