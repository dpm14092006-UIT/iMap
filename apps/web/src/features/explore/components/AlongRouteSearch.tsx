import { Icon } from '../../../shared/components/Icon';
import { alongRouteCategories, poiCatalog } from '../data/poiCatalog';
import type { PoiCategory, PoiSearchTerm } from '../types';

type AlongRouteSearchProps = {
  active: PoiCategory | null;
  onSelect: (term: PoiSearchTerm) => void;
};

/** Chip tìm dọc tuyến: Xăng, Sạc EV, Ăn uống, Cà phê, Khách sạn (từ khóa tự do gõ ở ô tìm kiếm chính). */
export function AlongRouteSearch({ active, onSelect }: AlongRouteSearchProps) {
  return (
    <div
      className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1"
      role="group"
      aria-label="Tìm dọc tuyến"
    >
      {alongRouteCategories.map((category) => {
        const meta = poiCatalog[category];
        const selected = active === category;
        return (
          <button
            key={category}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect({ category })}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold shadow-sm ring-1 backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-indigo-400/40 active:scale-95 ${selected ? 'bg-brand-gradient text-white ring-transparent' : 'bg-white/90 text-ink ring-black/5 hover:bg-white dark:hover:bg-slate-700/60 dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10'}`}
          >
            <Icon name={meta.icon} size={15} />
            {category === 'restaurant' ? 'Ăn uống' : meta.label}
          </button>
        );
      })}
    </div>
  );
}
