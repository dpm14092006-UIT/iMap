import type { LatLng } from '../../places/types';
import { FloatingPanel } from '../../../app/components/FloatingPanel';
import { Icon } from '../../../shared/components/Icon';
import type { TransportMode } from '../../map/types';
import { PlaceField } from '../../places/components/PlaceField';
import type { AlgorithmComparisonController } from '../hooks/useAlgorithmComparison';
import type { DirectionsController } from '../hooks/useDirections';
import { AlgorithmComparison } from './AlgorithmComparison';
import { RouteResultCard } from './RouteResultCard';

/** Ô nào đang chờ người dùng chọn điểm trên bản đồ. */
export type PickTarget = 'origin' | 'destination';

type RoutePanelProps = {
  getSearchFocus?: () => LatLng;
  directions: DirectionsController;
  /** So sánh Dijkstra / A* trên cùng điểm đi/đến (không cần key VietMap). */
  comparison: AlgorithmComparisonController;
  pickTarget: PickTarget | null;
  isLocating: boolean;
  onPickOnMap: (target: PickTarget) => void;
  onUseMyLocation: () => void;
  onSave: () => void;
  onClose: () => void;
};

const vehicles: { id: TransportMode; label: string; icon: 'car' | 'motorcycle' }[] = [
  { id: 'motorcycle', label: 'Xe máy', icon: 'motorcycle' },
  { id: 'car', label: 'Ô tô', icon: 'car' },
];

/** Panel chỉ đường A → B. Mọi trạng thái nằm trong hook useDirections, panel chỉ hiển thị. */
export function RoutePanel({ getSearchFocus, directions, comparison, pickTarget, isLocating, onPickOnMap, onUseMyLocation, onSave, onClose }: RoutePanelProps) {
  const { origin, destination, vehicle, route, isLoading, error } = directions;
  const canCalculate = Boolean(origin && destination) && origin?.id !== destination?.id && !isLoading;

  return (
    <FloatingPanel eyebrow="LỘ TRÌNH" title="Chỉ đường" icon="directions" onClose={onClose}>
      {/* Chọn loại xe: đổi xe khi đã có tuyến sẽ tự tính lại. */}
      <div className="vehicle-tabs mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Phương tiện">
        {vehicles.map((item) => (
          <button key={item.id} type="button" aria-pressed={vehicle === item.id} onClick={() => directions.setVehicle(item.id)} className={`flex min-w-0 items-center justify-center gap-2 rounded-[10px] px-1 py-2 text-[11px] font-semibold transition ${vehicle === item.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-ink'}`}>
            <Icon name={item.icon} size={18} />{item.label}
          </button>
        ))}
      </div>

      {/* Hai ô điểm đi / điểm đến, nối bằng đường chấm. */}
      <div className="relative space-y-2.5 pl-5 pr-9">
        <span className="route-connector" aria-hidden="true" />
        <div className="relative">
          <span className="absolute -left-[20px] top-[17px] z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          <PlaceField getFocus={getSearchFocus} ariaLabel="Điểm xuất phát" placeholder="Điểm xuất phát" place={origin} onChange={directions.setOrigin} />
        </div>
        <div className="relative">
          <span className="absolute -left-[20px] top-[17px] z-10 h-2.5 w-2.5 rounded-[3px] border-2 border-white bg-brand-500 shadow-sm" />
          <PlaceField getFocus={getSearchFocus} ariaLabel="Điểm đến" placeholder="Bạn muốn đi đâu?" place={destination} onChange={directions.setDestination} />
        </div>
        <button type="button" disabled={!origin || !destination} onClick={directions.swap} className="absolute right-0 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-40" aria-label="Đảo chiều điểm đi và điểm đến" title="Đảo chiều">
          <Icon name="swap" size={17} />
        </button>
      </div>

      {/* Cách chọn điểm khác: GPS hoặc click trên bản đồ. */}
      <div className="mt-3 flex flex-wrap gap-1.5 pl-5">
        <QuickAction icon="current-location" label={isLocating ? 'Đang định vị…' : 'Vị trí của tôi'} disabled={isLocating} onClick={onUseMyLocation} />
        <QuickAction icon="pin" label="Chọn điểm đi" active={pickTarget === 'origin'} onClick={() => onPickOnMap('origin')} />
        <QuickAction icon="pin" label="Chọn điểm đến" active={pickTarget === 'destination'} onClick={() => onPickOnMap('destination')} />
      </div>

      <div className="sticky bottom-0 z-20 -mx-5 mt-3 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-1 pt-3">
        <button type="button" disabled={!canCalculate} onClick={() => void directions.calculate()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[13px] font-bold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
          {isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <Icon name="route" size={18} />}
          {isLoading ? 'Đang lấy tuyến đường…' : 'Tìm đường'}
        </button>
      </div>

      {error && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900" role="alert">{error}</p>}

      {route && <RouteResultCard route={route} onSave={onSave} />}

      <details className="mt-3 border-t border-slate-100 pt-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">So sánh Dijkstra / A*</summary>
        <AlgorithmComparison comparison={comparison} canRun={Boolean(origin && destination) && origin?.id !== destination?.id} />
      </details>

      {!route && <div className="route-note mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-[10px] leading-[1.6] text-slate-500">
        <Icon name="compass" size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <p>Tuyến VietMap theo phương tiện đã chọn. Thời gian là ước tính.</p>
      </div>}
    </FloatingPanel>
  );
}

type QuickActionProps = { icon: 'current-location' | 'pin'; label: string; active?: boolean; disabled?: boolean; onClick: () => void };

/** Nút nhỏ dạng "chip" bên dưới hai ô nhập. */
function QuickAction({ icon, label, active = false, disabled = false, onClick }: QuickActionProps) {
  return (
    <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition disabled:opacity-60 ${active ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700'}`}>
      <Icon name={icon} size={13} />{label}
    </button>
  );
}
