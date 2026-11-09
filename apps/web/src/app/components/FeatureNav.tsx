import { Icon, type IconName } from '../../shared/components/Icon';
import type { FeatureKey } from '../../features/map/types';

const items: { key: Exclude<FeatureKey, 'place'>; label: string; icon: IconName }[] = [
  { key: 'assistant', label: 'Trợ lý địa điểm', icon: 'sparkles' },
  { key: 'directions', label: 'Chỉ đường', icon: 'directions' },
  { key: 'multi', label: 'Nhiều điểm', icon: 'multi-stop' },
  { key: 'traffic', label: 'Giao thông', icon: 'traffic' },
  { key: 'saved', label: 'Đã lưu', icon: 'bookmark' },
];

type FeatureNavProps = { isAuthenticated: boolean; active: FeatureKey | null; incidentCount: number; onSelect: (key: FeatureKey) => void };

export function FeatureNav({ isAuthenticated, active, incidentCount, onSelect }: FeatureNavProps) {
  return (
    <nav className="feature-nav absolute left-5 right-5 top-[84px] z-20 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-md:left-3 max-md:right-3 max-md:top-[119px]" aria-label="Công cụ bản đồ">
      {items.map((item) => {
        const selected = active === item.key;
        return <button key={item.key} type="button" onClick={() => onSelect(item.key)} aria-label={item.key === 'assistant' && !isAuthenticated ? 'Trợ lý địa điểm, yêu cầu đăng nhập' : undefined} aria-pressed={selected} className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12px] font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 sm:h-11 sm:px-4 sm:text-[13px] ${selected ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-white/90 bg-white/95 text-slate-700 hover:border-slate-200 hover:bg-white'}`}>
          <Icon name={item.icon} size={16} />{item.label}
          {item.key === 'assistant' && !isAuthenticated && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-semibold text-brand-700">Đăng nhập</span>}
          {item.key === 'traffic' && <span className="grid h-[19px] min-w-[19px] place-items-center rounded-full bg-orange-100 px-1 text-[10px] font-bold text-orange-700">{incidentCount}</span>}
        </button>;
      })}
    </nav>
  );
}
