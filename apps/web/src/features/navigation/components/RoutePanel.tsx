import { useState } from 'react';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import { routePlaces } from '../../map/data/demoPlaces';
import type { DemoPlace, RoutePlan, TransportMode } from '../../map/types';
import { PlaceCombobox } from '../../places/components/PlaceCombobox';

type RoutePanelProps = {
  initialDestination: DemoPlace | null;
  initialOrigin: DemoPlace;
  route: RoutePlan | null;
  onClose: () => void;
  onOriginChange: (place: DemoPlace | null) => void;
  onDestinationChange: (place: DemoPlace | null) => void;
  onClearRoute: () => void;
  onPreview: (origin: DemoPlace, destination: DemoPlace, mode: TransportMode) => Promise<RoutePlan | { error: string }>;
  onSave: (origin: DemoPlace, destination: DemoPlace) => void;
};

const modes: { id: TransportMode; label: string; icon: 'car' | 'motorcycle' }[] = [
  { id: 'car', label: 'Ô tô', icon: 'car' },
  { id: 'motorcycle', label: 'Xe máy', icon: 'motorcycle' },
];

export function RoutePanel({ initialDestination, initialOrigin, route, onClose, onOriginChange, onDestinationChange, onClearRoute, onPreview, onSave }: RoutePanelProps) {
  const [origin, setOrigin] = useState(initialOrigin.name);
  const [originPlace, setOriginPlace] = useState<DemoPlace | null>(initialOrigin);
  const [destinationText, setDestinationText] = useState(initialDestination?.name ?? '');
  const [destination, setDestination] = useState<DemoPlace | null>(initialDestination);
  const [mode, setMode] = useState<TransportMode>('motorcycle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const visibleResult = route?.kind === 'route' && route.vehicle === mode && route.stops[0]?.id === originPlace?.id && route.stops[1]?.id === destination?.id;
  const distance = route ? `${route.distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km` : '';
  const minutes = route?.durationMin ?? 0;
  const duration = minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${Math.round(minutes % 60)} phút` : `${Math.max(1, Math.round(minutes))} phút`;

  const calculate = async () => {
    if (!originPlace || !destination) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await onPreview(originPlace, destination, mode);
      if ('error' in result) setError(result.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FloatingPanel eyebrow="LỘ TRÌNH" title="Chỉ đường" icon="directions" onClose={onClose}>
      <div className="route-intro mb-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-sm"><Icon name="current-location" size={17} /></span>
        <div className="min-w-0"><p className="text-xs font-semibold text-ink">Chọn phương tiện</p><p className="mt-0.5 text-[10px] text-slate-500">Tuyến bám theo dữ liệu đường thực tế</p></div>
        <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">VietMap</span>
      </div>

      <div className="vehicle-tabs mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Phương tiện">
        {modes.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setError(''); onClearRoute(); }} className={`flex min-w-0 flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[10px] font-semibold transition ${mode === item.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-ink'}`}><Icon name={item.icon} size={19} />{item.label}</button>)}
      </div>

      <div className="relative space-y-2.5 pl-5">
        <span className="route-connector" aria-hidden="true" />
        <div className="relative">
          <span className="absolute -left-[20px] top-[17px] z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          <PlaceCombobox
            ariaLabel="Điểm xuất phát"
            icon={null}
            inputClassName="h-[46px] bg-white pl-3"
            onChange={(value) => { setOrigin(value); setOriginPlace(null); onOriginChange(null); }}
            onSelect={(place) => { setOrigin(place.name); setOriginPlace(place); onOriginChange(place); }}
            places={routePlaces}
            placeholder="Điểm xuất phát"
            value={origin}
          />
        </div>
        <div className="relative">
          <span className="absolute -left-[20px] top-[17px] z-10 h-2.5 w-2.5 rounded-[3px] border-2 border-white bg-brand-500 shadow-sm" />
          <PlaceCombobox
            ariaLabel="Điểm đến"
            icon={null}
            inputClassName="h-[46px] bg-white pl-3"
            onChange={(value) => {
              setDestinationText(value);
              setDestination(null);
              onDestinationChange(null);
            }}
            onSelect={(place) => { setDestination(place); onDestinationChange(place); }}
            places={routePlaces}
            placeholder="Bạn muốn đi đâu?"
            value={destinationText}
          />
        </div>
        <button type="button" className="absolute -right-1 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-200 hover:text-brand-600" aria-label="Đảo chiều điểm đi và điểm đến" title="Đảo chiều" onClick={() => {
          setOrigin(destinationText);
          setDestinationText(origin);
          setOriginPlace(destination);
          setDestination(originPlace);
          onOriginChange(destination);
          onDestinationChange(originPlace);
        }}><Icon name="swap" size={17} /></button>
      </div>

      <div className="my-3 flex items-center justify-between gap-2 pl-5 text-[11px]"><span className="text-slate-500">Kéo bản đồ để xem khu vực</span><span className="flex shrink-0 items-center gap-1 font-medium text-slate-500"><Icon name="pin" size={14} />TP. Hồ Chí Minh</span></div>

      <div className="sticky bottom-0 z-20 -mx-5 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-1 pt-3">
        <button type="button" disabled={isLoading || !destination || !originPlace || !origin.trim() || destination.id === originPlace.id} onClick={() => void calculate()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[13px] font-bold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">{isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <Icon name="route" size={18} />}{isLoading ? 'Đang lấy tuyến đường…' : 'Tìm đường'}<Icon name="arrow-up-right" size={16} className="ml-auto" /></button>
      </div>

      {error && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900" role="alert">{error}</p>}

      {visibleResult && <div className="mt-4 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Icon name="route" size={17} /></span><div><p className="text-[12px] font-bold text-ink">Tuyến theo đường thật</p><p className="mt-0.5 text-[10px] text-slate-500">VietMap · {mode === 'motorcycle' ? 'xe máy' : 'ô tô'}</p></div></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800">Đã tính</span></div>
        <div className="my-3 grid grid-cols-2 divide-x divide-brand-100 rounded-xl bg-white/80 py-2.5 text-center"><div><p className="text-[19px] font-bold tracking-tight text-ink">{distance}</p><p className="mt-0.5 text-[10px] text-slate-500">Khoảng cách ước tính</p></div><div><p className="text-[19px] font-bold tracking-tight text-ink">{duration}</p><p className="mt-0.5 text-[10px] text-slate-500">Thời gian ước tính</p></div></div>
        {route.legs[0]?.instructions && route.legs[0].instructions.length > 0 && <ol className="mb-3 max-h-44 space-y-1.5 overflow-y-auto rounded-xl bg-white/80 p-2.5" aria-label="Chỉ dẫn từng chặng">{route.legs[0].instructions.map((step, index) => <li key={`${index}-${step.streetName}`} className="flex items-start gap-2 text-[10px] leading-4 text-slate-700"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-700">{index + 1}</span><span className="min-w-0 flex-1">{step.text || step.streetName || 'Tiếp tục theo đường'}</span><span className="shrink-0 text-slate-400">{step.distanceMeters >= 1000 ? `${(step.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(step.distanceMeters)} m`}</span></li>)}</ol>}
        <div className="flex items-center justify-between gap-3"><p className="text-[10px] leading-4 text-slate-500">Thời gian có thể đổi theo giao thông.</p><button type="button" onClick={() => destination && originPlace && onSave(originPlace, destination)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"><Icon name="bookmark" size={14} />Lưu tuyến</button></div>
      </div>}

      <div className="route-note mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-[10px] leading-[1.6] text-slate-500"><Icon name="compass" size={14} className="mt-0.5 shrink-0 text-slate-400" /><p>VietMap tính tuyến theo loại xe và trả chỉ dẫn từng chặng. Thời gian có thể đổi theo giao thông thực tế.</p></div>
    </FloatingPanel>
  );
}
