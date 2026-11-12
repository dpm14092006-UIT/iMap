import { SheetPanel } from '../../../app/layout/SheetPanel';
import { Icon } from '../../../shared/components/Icon';
import { poiMetaFor } from '../../explore/data/poiCatalog';
import { formatDistanceMeters } from '../../navigation/utils/format';
import type { Poi } from '../../explore/types';
import { formatCoordinates } from '../services/placeFromPoint';
import type { Place, PlaceSource } from '../types';

type PlacePanelProps = {
  place: Place;
  /** Có khi địa điểm đến từ kết quả khám phá: hiện thêm danh mục và vị trí so với tuyến. */
  poi?: Poi | null;
  onClose: () => void;
  onDirections: (place: Place) => void;
};

/** Mô tả nguồn dữ liệu của địa điểm cho người dùng. */
const sourceLabels: Record<PlaceSource, string> = {
  popular: 'Địa điểm gợi ý có sẵn',
  vietmap: 'Tìm thấy qua VietMap',
  osm: 'Tìm thấy qua Photon / OpenStreetMap',
  map: 'Điểm chọn trên bản đồ',
  gps: 'Vị trí GPS của thiết bị',
  poi: 'Tìm thấy qua VietMap',
};

/** Panel chi tiết một địa điểm, có nút "Tìm đường đến đây". */
export function PlacePanel({ place, poi, onClose, onDirections }: PlacePanelProps) {
  return (
    <SheetPanel eyebrow="ĐỊA ĐIỂM" title="Chi tiết địa điểm" icon="pin" onClose={onClose}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 dark:from-indigo-400/20 via-blue-50 dark:via-blue-400/10 to-emerald-50 dark:to-emerald-400/10 px-4 py-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border-[20px] border-white/30" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-800/60 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:text-indigo-300">
          <Icon name="globe" size={13} />
          {place.category}
        </span>
        <h3 className="relative mt-4 text-[20px] font-bold tracking-tight text-ink dark:text-slate-100">
          {place.name}
        </h3>
        <p className="relative mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <Icon name="pin" size={14} />
          {place.address}
        </p>
      </div>
      {poi && (
        <div className="mt-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/60 px-3 py-3 text-[12px] text-slate-700 dark:text-slate-200">
          <p className="font-semibold">{poiMetaFor(poi.category).label}</p>
          <p className="mt-1.5 text-slate-600 dark:text-slate-300">
            {poi.distanceFromCenterM === undefined
              ? `Cách tuyến ${formatDistanceMeters(poi.distanceFromRouteM)} · ${
                  poi.detourMin > 0 ? `đi vòng khoảng ${poi.detourMin} phút` : 'ngay trên đường đi'
                }`
              : `Cách tâm tìm kiếm ${formatDistanceMeters(poi.distanceFromCenterM)}`}
          </p>
        </div>
      )}
      <div className="mt-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/60 px-3 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400">
          Tọa độ
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
          {formatCoordinates(place)}
          <br />
          {sourceLabels[place.source]}
        </p>
      </div>
      <a
        href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/60 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-200 dark:hover:border-indigo-300/30 hover:text-brand-700 dark:hover:text-indigo-300"
      >
        <Icon name="arrow-up-right" size={15} />
        Mở địa điểm trên OpenStreetMap
      </a>
      <button
        type="button"
        onClick={() => onDirections(place)}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white transition hover:bg-brand-700"
      >
        <Icon name="directions" size={17} />
        Tìm đường đến đây
      </button>
      <p className="mt-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Nguồn địa điểm được ghi rõ theo từng kết quả ở trên.
      </p>
    </SheetPanel>
  );
}
