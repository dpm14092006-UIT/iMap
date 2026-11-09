import { Icon } from '../../../shared/components/Icon';
import type { MapLayer } from '../types';

type MapToolbarProps = {
  layer: MapLayer;
  automatic: boolean;
  onLayerChange: (layer: MapLayer) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
};

export function MapToolbar({ layer, automatic, onLayerChange, onZoomIn, onZoomOut, onLocate }: MapToolbarProps) {
  return (
    <div className="map-controls absolute bottom-6 right-5 z-20 flex flex-col items-end gap-2 max-md:bottom-[calc(56dvh+10px)] max-md:right-3">
      <div className="flex items-center rounded-full border border-white bg-white/95 p-1 shadow-lg shadow-slate-900/10 backdrop-blur-md max-md:p-0.5" role="group" aria-label="Kiểu bản đồ">
        <button type="button" aria-pressed={layer !== 'satellite'} onClick={() => onLayerChange('street')} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition max-md:gap-1 max-md:px-2.5 max-md:py-1.5 max-md:text-[10px] ${layer !== 'satellite' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-ink'}`}><Icon name="layers" size={15} /> Bản đồ</button>
        <button type="button" aria-pressed={layer === 'satellite'} onClick={() => onLayerChange('satellite')} className={`rounded-full px-3 py-2 text-[11px] font-semibold transition max-md:px-2.5 max-md:py-1.5 max-md:text-[10px] ${layer === 'satellite' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-ink'}`}>Vệ tinh</button>
        <span title={automatic ? 'Tự động theo giờ thiết bị: tối từ 18:00 đến 06:00' : 'Giao diện desktop dùng nền sáng'} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition max-md:gap-1 max-md:px-2.5 max-md:py-1.5 max-md:text-[10px] ${layer === 'dark' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-ink'}`}><Icon name="moon" size={14} />{!automatic ? 'Nền sáng' : layer === 'satellite' ? '18h–6h tự tối' : layer === 'dark' ? 'Tối · tự động' : 'Sáng · tự động'}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur-md" role="group" aria-label="Điều khiển bản đồ">
        <button type="button" onClick={onLocate} aria-label="Định vị vị trí hiện tại" title="Định vị vị trí hiện tại" className="map-locate grid h-11 w-11 place-items-center text-slate-600 transition hover:bg-slate-50 hover:text-brand-600"><Icon name="current-location" size={19} /></button>
        <div className="mx-2 h-px bg-slate-100" />
        <button type="button" onClick={onZoomIn} aria-label="Phóng to bản đồ" className="grid h-10 w-11 place-items-center text-slate-600 transition hover:bg-slate-50 hover:text-brand-600 max-md:h-9 max-md:w-10"><Icon name="plus" size={20} /></button>
        <div className="mx-2 h-px bg-slate-100" />
        <button type="button" onClick={onZoomOut} aria-label="Thu nhỏ bản đồ" className="grid h-10 w-11 place-items-center text-slate-600 transition hover:bg-slate-50 hover:text-brand-600 max-md:h-9 max-md:w-10"><Icon name="minus" size={20} /></button>
      </div>
    </div>
  );
}
