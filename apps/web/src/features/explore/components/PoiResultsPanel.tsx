import type { KeyboardEvent } from 'react';
import { SheetPanel } from '../../../app/layout/SheetPanel';
import { Icon } from '../../../shared/components/Icon';
import { poiMetaFor, termLabel } from '../data/poiCatalog';
import type { PoiMode, PoiSearchController } from '../hooks/usePoiSearch';
import { formatRadius } from '../services/poiOptions';
import type { Poi, PoiSearchTerm } from '../types';
import { PoiCard } from './PoiCard';
import { PoiFilters } from './PoiFilters';

type PoiResultsPanelProps = {
  term: PoiSearchTerm;
  mode: PoiMode;
  search: PoiSearchController;
  highlightedId: string | null;
  canAddStop: boolean;
  onHover: (poiId: string | null) => void;
  onSelect: (poi: Poi) => void;
  onDirections: (poi: Poi) => void;
  onToggleSave: (poi: Poi) => void;
  onAddStop: (poi: Poi) => void;
  /** Quay về panel chỉ đường (chỉ khi tìm dọc tuyến). */
  onBack?: () => void;
  onClose: () => void;
};

function Skeleton() {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <li key={item} className="flex animate-pulse gap-3 rounded-3xl bg-black/[.04] p-2.5 dark:bg-white/5">
          <span className="h-16 w-16 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <span className="flex-1 space-y-2 py-1">
            <span className="block h-3.5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
            <span className="block h-3 w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
            <span className="block h-3 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Danh sách kết quả POI, dùng chung cho "quanh đây" và "dọc tuyến". */
export function PoiResultsPanel({
  term,
  mode,
  search,
  highlightedId,
  canAddStop,
  onHover,
  onSelect,
  onDirections,
  onToggleSave,
  onAddStop,
  onBack,
  onClose,
}: PoiResultsPanelProps) {
  const meta = poiMetaFor(term.category ?? null);
  const { status, pois } = search;
  const label = termLabel(term);
  const quoted = term.query ? label : `“${label}”`;
  const title = `${label} ${mode === 'alongRoute' ? 'dọc tuyến' : 'quanh đây'}`;
  const where = mode === 'alongRoute' ? 'quanh tuyến' : 'quanh đây';

  // Mũi tên ↑ ↓ di chuyển giữa các thẻ kết quả.
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-poi-main]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    event.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  return (
    <SheetPanel
      eyebrow="Khám phá"
      title={title}
      icon={meta.icon}
      onClose={onClose}
      {...(onBack ? { onBack } : {})}
      footer={
        <div className="space-y-1.5">
          {mode === 'nearby' && (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink dark:text-slate-200">
              <input
                type="checkbox"
                checked={search.followMap}
                onChange={(event) => search.setFollowMap(event.target.checked)}
                className="h-4 w-4 accent-brand-600 dark:accent-indigo-400"
              />
              Cập nhật kết quả khi di chuyển bản đồ
            </label>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Nguồn: VietMap</p>
        </div>
      }
    >
      <PoiFilters
        mode={mode}
        sort={search.sort}
        radiusM={search.radiusM}
        onSortChange={search.setSort}
        onRadiusChange={search.setRadiusM}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {status === 'ready' ? `${pois.length} kết quả` : status === 'loading' ? 'Đang tìm…' : ''}
      </div>
      {status === 'loading' && pois.length === 0 && <Skeleton />}
      {status === 'error' && (
        <div role="alert" className="rounded-2xl bg-amber-50 dark:bg-amber-400/10 px-3 py-3 text-xs text-amber-900 dark:text-amber-100">
          <p>{search.error}</p>
          <button
            type="button"
            onClick={search.retry}
            className="mt-2 inline-flex h-8 items-center rounded-full bg-amber-100 dark:bg-amber-400/15 px-3 font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-400/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
          >
            Thử lại
          </button>
        </div>
      )}
      {status === 'idle' && mode === 'alongRoute' && (
        <p className="rounded-2xl bg-black/[.04] px-3 py-4 text-center text-xs text-ink-soft dark:bg-white/5 dark:text-slate-300">
          Chưa có tuyến để tìm dọc đường. Hãy tính tuyến ở bảng Chỉ đường.
        </p>
      )}
      {status === 'ready' && pois.length === 0 && (
        <div className="rounded-2xl bg-black/[.04] px-3 py-6 text-center dark:bg-white/5">
          <Icon name="search" size={22} className="mx-auto text-slate-400 dark:text-slate-500" />
          <p className="mt-2 text-sm font-semibold text-ink dark:text-white">
            Không thấy {quoted} trong {formatRadius(search.radiusM)} {where}
          </p>
          <p className="mt-1 text-xs text-ink-soft dark:text-slate-300">
            Thử mở rộng bán kính hoặc đổi từ khóa.
          </p>
        </div>
      )}
      {pois.length > 0 && (
        <ul
          className={`space-y-3 transition-opacity ${status === 'loading' ? 'opacity-50' : ''}`}
          aria-label={title}
          onKeyDown={onListKeyDown}
        >
          {pois.map((poi) => (
            <PoiCard
              key={poi.id}
              poi={poi}
              mode={mode}
              highlighted={highlightedId === poi.id}
              saved={search.savedIds.has(poi.id)}
              canAddStop={canAddStop}
              onSelect={onSelect}
              onDirections={onDirections}
              onToggleSave={onToggleSave}
              onAddStop={onAddStop}
              onHover={onHover}
            />
          ))}
        </ul>
      )}
    </SheetPanel>
  );
}
