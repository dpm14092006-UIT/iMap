import { useEffect, useState } from 'react';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import { popularPlaces } from '../../places/data/popularPlaces';
import type { RouteObjective, RoutePlan, TransportMode } from '../../map/types';
import type { LatLng, Place } from '../../places/types';
import { PlaceCombobox } from '../../places/components/PlaceCombobox';
import { algorithmOptions, MAX_EXACT_STOPS, MAX_STOPS, type AlgorithmChoice } from '../utils/algorithms';
import { OptimizationSummary } from './OptimizationSummary';

type MultiStopPanelProps = { isActive: boolean; onShowPlan: (plan: RoutePlan) => void; getFocus?: () => LatLng; onReset: (planId?: string) => void; onClose: () => void; onPlanRoute: (start: Place, stops: Place[], mode: TransportMode, objective: RouteObjective, returnToStart: boolean, algorithm: AlgorithmChoice) => Promise<RoutePlan | { error: string }>; onSave?: (plan: RoutePlan) => void };

export function MultiStopPanel({ isActive, onShowPlan, onClose, onPlanRoute, onSave, getFocus, onReset }: MultiStopPanelProps) {
  const [stops, setStops] = useState<Place[]>([]);
  const [start, setStart] = useState<Place | null>(null);
  const [startText, setStartText] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<TransportMode>('motorcycle');
  const [returnToStart, setReturnToStart] = useState(false);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [objective, setObjective] = useState<RouteObjective>('time');
  const [algorithm, setAlgorithm] = useState<AlgorithmChoice>('auto');
  // Held–Karp chỉ hỗ trợ tối đa MAX_EXACT_STOPS điểm ghé.
  const exactTooMany = algorithm === 'exact' && stops.length > MAX_EXACT_STOPS;
  useEffect(() => { if (isActive && plan) onShowPlan(plan); }, [isActive, plan, onShowPlan]);


  const addStop = (place: Place) => {
    if (stops.length >= MAX_STOPS) { setError(`Tối đa ${MAX_STOPS} điểm cần ghé.`); return; }
    if ([...(start ? [start] : []), ...stops].some((item) => Math.abs(item.lat - place.lat) < 0.000001 && Math.abs(item.lng - place.lng) < 0.000001)) { setError('Điểm này đã có trong hành trình.'); return; }
    setStops((current) => current.some((item) => item.id === place.id) ? current : [...current, place].slice(0, MAX_STOPS));
    setQuery('');
    setPlan(null);
    setError('');
  };

  return (
    <FloatingPanel eyebrow="LẬP KẾ HOẠCH" title="Hành trình nhiều điểm" icon="multi-stop" onClose={onClose}>
      <p className="mb-4 text-[12px] leading-5 text-slate-500">Chọn các điểm cần ghé. Tự sắp xếp thứ tự tốt nhất theo thời gian hoặc quãng đường, giữ cố định điểm xuất phát.</p>
      <fieldset disabled={isLoading}>
      {(start || stops.length > 0 || query || startText) && <button type="button" onClick={() => { onReset(plan?.id); setStart(null); setStartText(''); setStops([]); setQuery(''); setPlan(null); setError(''); }} className="mb-3 text-[10px] font-semibold text-slate-500 underline">Xóa hành trình</button>}
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.09em] text-slate-500">Điểm xuất phát</p>
        <PlaceCombobox ariaLabel="Điểm xuất phát hành trình nhiều điểm" className="w-full" icon="current-location" inputClassName="h-10 bg-white" getFocus={getFocus} onChange={(value) => { setStartText(value); setStart(null); setPlan(null); }} onSelect={(place) => { if (stops.some((stop) => Math.abs(stop.lat - place.lat) < 0.000001 && Math.abs(stop.lng - place.lng) < 0.000001)) { setError('Điểm xuất phát trùng một điểm cần ghé.'); return; } setStart(place); setStartText(place.name); setPlan(null); setError(''); }} places={popularPlaces} placeholder="Chọn điểm xuất phát" value={startText} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">Phương tiện</span><select value={mode} onChange={(event) => { setMode(event.target.value as TransportMode); setPlan(null); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"><option value="motorcycle">Xe máy</option><option value="car">Ô tô</option></select></label>
          <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">Ưu tiên</span><select value={objective} onChange={(event) => { setObjective(event.target.value as RouteObjective); setPlan(null); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"><option value="time">Thời gian</option><option value="distance">Quãng đường</option></select></label>
      </div>

      <label className="mb-3 block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">Thuật toán sắp xếp</span><select value={algorithm} onChange={(event) => { setAlgorithm(event.target.value as AlgorithmChoice); setPlan(null); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">{algorithmOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><span className="mt-1 block text-[10px] leading-4 text-slate-500">Tự động/Chính xác: Held–Karp, luôn ra thứ tự tối ưu. Nhanh: NN + 2-opt, gần đúng để so sánh.</span></label>
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600"><input type="checkbox" checked={returnToStart} onChange={(event) => { setReturnToStart(event.target.checked); setPlan(null); }} className="h-3.5 w-3.5 accent-brand-600" />Quay lại điểm xuất phát</label>
      <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-bold text-ink">Điểm cần ghé</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{stops.length}/{MAX_STOPS}</span></div>
      <ol className="mb-3 space-y-1.5" aria-label="Danh sách điểm dừng">
        {stops.map((place, index) => <li key={place.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${index === 0 ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>{String(index + 1).padStart(2, '0')}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-ink">{place.name}</span><span className="mt-0.5 block text-[10px] text-slate-500">{place.address}</span></span>
          <button type="button" onClick={() => { setStops((current) => current.filter((stop) => stop.id !== place.id)); setPlan(null); }} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Xóa ${place.name}`}><Icon name="close" size={16} /></button>
        </li>)}
      </ol>
      <div className="mb-4"><PlaceCombobox getFocus={getFocus} ariaLabel="Tìm điểm dừng để thêm" className="w-full" icon="plus" inputClassName="h-[44px] bg-white" onChange={setQuery} onSelect={addStop} places={popularPlaces.filter((place) => !stops.some((stop) => stop.id === place.id))} placeholder="Thêm điểm dừng" value={query} /></div>
      <div className="sticky bottom-0 z-20 -mx-5 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-1 pt-3">
        <button type="button" onClick={() => { void (async () => { setIsLoading(true); setError(''); try { if (!start) { setError('Hãy chọn điểm xuất phát từ gợi ý.'); return; } const result = await onPlanRoute(start, stops, mode, objective, returnToStart, algorithm); if ('error' in result) { setError(result.error); setPlan(null); } else { setPlan(result); setStops(result.stops.slice(1, returnToStart ? -1 : undefined)); } } catch { setError('Không tính được hành trình. Hãy thử lại.'); } finally { setIsLoading(false); } })(); }} disabled={isLoading || !start || stops.length < 1 || exactTooMany} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:bg-slate-300 disabled:shadow-none">{isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <Icon name="route" size={17} />}{isLoading ? 'Đang tối ưu đường đi…' : 'Tối ưu hành trình'}</button>
      </div>

      </fieldset>
      {exactTooMany && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900" role="alert">Thuật toán chính xác chỉ hỗ trợ tối đa {MAX_EXACT_STOPS} điểm ghé. Hãy chọn "Tự động" hoặc "Nhanh".</p>}
      {error && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900" role="alert">{error}</p>}
      {plan && <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-3" role="status"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold text-brand-800">Đã sắp xếp hành trình</p><p className="mt-1 text-[10px] text-brand-800/80">{plan.distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km · {Math.round(plan.durationMin)} phút</p></div><button type="button" onClick={() => onSave?.(plan)} className="rounded-lg border border-brand-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-brand-700">Lưu</button></div>{plan.optimization && <OptimizationSummary optimization={plan.optimization} />}<ol className="mt-3 space-y-1.5">{plan.stops.map((place, index) => <li key={`${place.id}-${index}`} className="flex items-center gap-2 text-[10px] font-medium text-slate-700"><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[9px] font-bold text-brand-700">{index === 0 ? 'A' : index === plan.stops.length - 1 && place.id === start?.id ? '↩' : index}</span>{place.name}</li>)}</ol></div>}
      <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-5 text-slate-500">Tối ưu theo chi phí đường bộ VietMap, có xét chiều di chuyển. Để đi theo thứ tự tự chọn, dùng mục Chỉ đường.</div>
    </FloatingPanel>
  );
}
