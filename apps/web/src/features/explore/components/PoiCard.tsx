import { Icon } from '../../../shared/components/Icon';
import { formatDistanceMeters } from '../../navigation/utils/format';
import { poiMetaFor } from '../data/poiCatalog';
import type { Poi } from '../types';

type PoiCardProps = {
  poi: Poi;
  mode: 'nearby' | 'alongRoute';
  highlighted: boolean;
  saved: boolean;
  /** Có tuyến đang chọn nên cho phép "Thêm điểm dừng". */
  canAddStop: boolean;
  onSelect: (poi: Poi) => void;
  onDirections: (poi: Poi) => void;
  onToggleSave: (poi: Poi) => void;
  onAddStop: (poi: Poi) => void;
  onHover: (poiId: string | null) => void;
};

/** Ô đại diện: nền gradient theo màu danh mục + biểu tượng (dữ liệu không có ảnh thật). */
function PoiTile({ poi }: { poi: Poi }) {
  const meta = poiMetaFor(poi.category);
  return (
    <span
      className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-white"
      style={{ background: `linear-gradient(135deg, ${meta.color}, #312e81)` }}
      aria-hidden="true"
    >
      <Icon name={meta.icon} size={26} />
    </span>
  );
}

/** Thẻ một địa điểm trong danh sách khám phá / dọc tuyến. */
export function PoiCard({
  poi,
  mode,
  highlighted,
  saved,
  canAddStop,
  onSelect,
  onDirections,
  onToggleSave,
  onAddStop,
  onHover,
}: PoiCardProps) {
  const meta = poiMetaFor(poi.category);
  const facts =
    mode === 'alongRoute'
      ? [
          `Cách tuyến ${formatDistanceMeters(poi.distanceFromRouteM)}`,
          poi.detourMin > 0 ? `+${poi.detourMin} phút đi vòng` : 'Ngay trên đường đi',
          `Km ${(poi.positionAlongRouteM / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} trên tuyến`,
        ]
      : [`Cách ${formatDistanceMeters(poi.distanceFromCenterM ?? 0)}`];
  const actionClass =
    'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-95';

  return (
    <li
      onMouseEnter={() => onHover(poi.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(poi.id)}
      onBlur={() => onHover(null)}
      className={`rounded-3xl p-2.5 ring-1 transition ${highlighted ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/15 dark:ring-brand-400/50' : 'bg-white/70 ring-black/5 dark:bg-white/5 dark:ring-white/10'}`}
    >
      <button
        type="button"
        data-poi-main
        onClick={() => onSelect(poi)}
        className="flex w-full gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40"
      >
        <PoiTile poi={poi} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink dark:text-white">{poi.name}</span>
          <span className="mt-0.5 block text-xs font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {poi.address && (
            <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft dark:text-slate-300">
              {poi.address}
            </span>
          )}
          <span className="mt-1 flex flex-wrap gap-1">
            {facts.map((fact) => (
              <span
                key={fact}
                className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-ink-soft dark:bg-white/10 dark:text-slate-300"
              >
                {fact}
              </span>
            ))}
          </span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDirections(poi)}
          className={`${actionClass} bg-brand-gradient text-white shadow-sm`}
        >
          <Icon name="directions" size={14} />
          Chỉ đường
        </button>
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => onToggleSave(poi)}
          className={`${actionClass} ring-1 ${saved ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:ring-indigo-300/40 dark:bg-brand-500/20 dark:text-brand-200' : 'text-ink-soft ring-black/10 hover:bg-black/5 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/10'}`}
        >
          <Icon name="bookmark" size={14} className={saved ? 'fill-current' : ''} />
          {saved ? 'Đã lưu' : 'Lưu'}
        </button>
        {canAddStop && (
          <button
            type="button"
            onClick={() => onAddStop(poi)}
            className={`${actionClass} text-ink-soft ring-1 ring-black/10 hover:bg-black/5 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/10`}
          >
            <Icon name="plus" size={14} />
            Thêm điểm dừng
          </button>
        )}
      </div>
    </li>
  );
}
