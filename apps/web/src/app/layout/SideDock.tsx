import { Icon, type IconName } from '../../shared/components/Icon';
import type { FeatureKey } from '../../features/map/types';
import { BrandMark } from './BrandMark';

const items: { key: Exclude<FeatureKey, 'place' | 'poi'>; label: string; icon: IconName }[] = [
  { key: 'directions', label: 'Chỉ đường', icon: 'directions' },
  { key: 'multi', label: 'Nhiều điểm', icon: 'multi-stop' },
  { key: 'traffic', label: 'Giao thông', icon: 'traffic' },
  { key: 'saved', label: 'Đã lưu', icon: 'bookmark' },
  { key: 'assistant', label: 'Trợ lý', icon: 'sparkles' },
];

type SideDockProps = {
  isAuthenticated: boolean;
  active: FeatureKey | null;
  incidentCount: number;
  onSelect: (key: FeatureKey) => void;
};

/** Dock dọc bên trái (desktop/tablet) và thanh tab đáy (mobile) cho các chức năng chính. */
export function SideDock({ isAuthenticated, active, incidentCount, onSelect }: SideDockProps) {
  const itemLabel = (key: FeatureKey, label: string) =>
    key === 'assistant' && !isAuthenticated ? 'Trợ lý địa điểm, yêu cầu đăng nhập' : label;
  const badge = (key: FeatureKey) =>
    key === 'traffic' && incidentCount > 0 ? (
      <span className="absolute right-1.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
        {incidentCount > 99 ? '99+' : incidentCount}
      </span>
    ) : null;

  return (
    <>
      <nav
        className="absolute bottom-3 left-3 top-3 z-30 hidden w-14 flex-col items-center gap-1 rounded-3xl bg-white/85 py-3 shadow-glass ring-1 ring-black/5 backdrop-blur-xl md:flex lg:w-16 dark:bg-slate-900/90 dark:shadow-glass-dark dark:ring-white/10"
        aria-label="Công cụ bản đồ"
      >
        <BrandMark className="mb-3" />
        {items.map((item) => {
          const selected = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-label={itemLabel(item.key, item.label)}
              aria-pressed={selected}
              title={item.label}
              className={`relative flex w-11 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 active:scale-95 lg:w-14 dark:focus-visible:ring-brand-500/40 ${selected ? 'bg-brand-gradient text-white shadow-md shadow-indigo-900/25' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100'}`}
            >
              <Icon name={item.icon} size={21} />
              <span className="hidden lg:block">{item.label}</span>
              {badge(item.key)}
            </button>
          );
        })}
      </nav>

      <nav
        className="absolute inset-x-0 bottom-0 z-30 grid h-[var(--tab-h)] grid-cols-5 border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(30,27,75,.12)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-900/95 dark:shadow-glass-dark"
        aria-label="Công cụ bản đồ (thanh tab)"
      >
        {items.map((item) => {
          const selected = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-label={itemLabel(item.key, item.label)}
              aria-pressed={selected}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-200 active:scale-95 dark:focus-visible:ring-brand-500/40 ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-ink-soft hover:text-brand-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              {selected && (
                <span
                  className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand-gradient"
                  aria-hidden="true"
                />
              )}
              <Icon name={item.icon} size={22} />
              {item.label}
              {badge(item.key)}
            </button>
          );
        })}
      </nav>
    </>
  );
}
