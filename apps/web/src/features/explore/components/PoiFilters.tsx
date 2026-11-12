import { useState, type ReactNode } from 'react';
import { Popover } from '../../../app/layout/Popover';
import { Icon } from '../../../shared/components/Icon';
import { formatRadius, poiRadiusOptions, poiSortLabels, poiSortsByMode } from '../services/poiOptions';
import type { PoiSort } from '../types';

type PoiFiltersProps = {
  mode: 'nearby' | 'alongRoute';
  sort: PoiSort;
  radiusM: number;
  onSortChange: (sort: PoiSort) => void;
  onRadiusChange: (radiusM: number) => void;
};

const chipClass = (active: boolean) =>
  `inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 ${active ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400/50' : 'bg-white/70 text-ink-soft ring-black/10 hover:bg-white dark:hover:bg-slate-700/60 dark:bg-white/5 dark:text-slate-200 dark:ring-white/15'}`;

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:hover:bg-white/10 ${selected ? 'text-brand-700 dark:text-brand-200' : 'text-ink dark:text-slate-200'}`}
    >
      {children}
      {selected && <Icon name="check" size={14} />}
    </button>
  );
}

/** Thanh lọc chỉ gồm những gì dữ liệu thật hỗ trợ: Sắp xếp (khi có nhiều cách) và Bán kính. */
export function PoiFilters({ mode, sort, radiusM, onSortChange, onRadiusChange }: PoiFiltersProps) {
  const [openMenu, setOpenMenu] = useState<'sort' | 'radius' | null>(null);
  const sorts = poiSortsByMode[mode];
  const menu = (id: 'sort' | 'radius') => ({
    open: openMenu === id,
    onClose: () => setOpenMenu((current) => (current === id ? null : current)),
  });
  const trigger = (id: 'sort' | 'radius', label: string) => (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={openMenu === id}
      onClick={() => setOpenMenu((current) => (current === id ? null : id))}
      className={chipClass(false)}
    >
      {label}
      <Icon name="chevron-down" size={13} />
    </button>
  );

  return (
    <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Bộ lọc">
      {sorts.length > 1 && (
        <Popover
          {...menu('sort')}
          label="Sắp xếp"
          panelClassName="left-0 top-full mt-1.5 w-48 !p-1.5"
          trigger={trigger('sort', `Sắp xếp: ${poiSortLabels[sort]}`)}
        >
          <div role="menu" aria-label="Sắp xếp theo">
            {sorts.map((option) => (
              <OptionButton
                key={option}
                selected={sort === option}
                onClick={() => {
                  onSortChange(option);
                  setOpenMenu(null);
                }}
              >
                {poiSortLabels[option]}
              </OptionButton>
            ))}
          </div>
        </Popover>
      )}
      <Popover
        {...menu('radius')}
        label="Bán kính"
        panelClassName="left-0 top-full mt-1.5 w-44 !p-1.5"
        trigger={trigger('radius', `Bán kính: ${formatRadius(radiusM)}`)}
      >
        <div role="menu" aria-label="Bán kính tìm kiếm">
          {poiRadiusOptions.map((option) => (
            <OptionButton
              key={option}
              selected={radiusM === option}
              onClick={() => {
                onRadiusChange(option);
                setOpenMenu(null);
              }}
            >
              {formatRadius(option)}
            </OptionButton>
          ))}
        </div>
      </Popover>
    </div>
  );
}
