import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/Icon';
import { poiCatalog, poiCategoryOrder } from '../data/poiCatalog';
import type { PoiCategory, PoiSearchTerm } from '../types';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type CategoryChipsProps = { active: PoiCategory | null; onSelect: (term: PoiSearchTerm) => void };

/** Hàng chip danh mục cuộn ngang; có nút mũi tên khi nội dung tràn (desktop). */
export function CategoryChips({ active, onSelect }: CategoryChipsProps) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    setOverflow({
      left: element.scrollLeft > 4,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (scroller.current) observer.observe(scroller.current);
    return () => observer.disconnect();
  }, [measure]);

  const scrollBy = (direction: -1 | 1) =>
    scroller.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });

  const arrow = (direction: -1 | 1) => (
    <button
      type="button"
      onClick={() => scrollBy(direction)}
      aria-label={t(direction < 0 ? 'Cuộn danh mục sang trái' : 'Cuộn danh mục sang phải')}
      className={`absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 dark:ring-white/10 transition hover:text-brand-700 dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 md:grid dark:bg-slate-800 dark:text-slate-200 ${direction < 0 ? 'left-0' : 'right-0'}`}
    >
      <Icon name={direction < 0 ? 'chevron-left' : 'chevron-right'} size={18} />
    </button>
  );

  return (
    <div className="relative">
      {overflow.left && arrow(-1)}
      <div
        ref={scroller}
        onScroll={measure}
        className="no-scrollbar flex gap-2 overflow-x-auto py-1 pr-1 max-md:pr-6 max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]"
        role="group"
        aria-label={t('Khám phá quanh đây')}
      >
        {poiCategoryOrder.map((category) => {
          const meta = poiCatalog[category];
          const selected = active === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect({ category })}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[13px] font-semibold shadow-sm ring-1 backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-indigo-400/40 active:scale-95 ${selected ? 'scale-[1.03] bg-brand-gradient text-white ring-transparent shadow-md' : 'bg-white/90 text-ink ring-black/5 hover:bg-white dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-slate-800'}`}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-white"
                style={{ backgroundColor: selected ? 'rgb(255 255 255 / 25%)' : meta.color }}
              >
                <Icon name={meta.icon} size={15} />
              </span>
              {t(meta.label)}
            </button>
          );
        })}
      </div>
      {overflow.right && arrow(1)}
    </div>
  );
}
