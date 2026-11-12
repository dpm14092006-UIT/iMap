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
  onStartNavigation: (route: NonNullable<DirectionsController['route']>) => void;
  isNavigating: boolean;
  onClose: () => void;
};

const vehicles: { id: TransportMode; label: string; icon: 'car' | 'motorcycle' }[] = [
  { id: 'motorcycle', label: 'Xe máy', icon: 'motorcycle' },
  { id: 'car', label: 'Ô tô', icon: 'car' },
];

/** Panel chỉ đường A → B. Mọi trạng thái nằm trong hook useDirections, panel chỉ hiển thị. */
export function RoutePanel({
  getSearchFocus,
  directions,
  comparison,
  pickTarget,
  isLocating,
  onPickOnMap,
  onUseMyLocation,
  onSave,
  onStartNavigation,
  isNavigating,
  onClose,
}: RoutePanelProps) {
  const { origin, destination, vehicle, objective, avoidFerry, route, routeOptions, isLoading, error } =
    directions;
  const canCalculate =
    Boolean(origin && destination) &&
    directions.waypoints.every((item) => item.place) &&
    (origin?.id !== destination?.id || directions.waypoints.length > 0) &&
    !isLoading;

  return (
    <FloatingPanel eyebrow="LỘ TRÌNH" title="Chỉ đường" icon="directions" onClose={onClose}>
      {/* Chọn loại xe: đổi xe khi đã có tuyến sẽ tự tính lại. */}
      <div
        className="vehicle-tabs mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
        role="group"
        aria-label="Phương tiện"
      >
        {vehicles.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={vehicle === item.id}
            onClick={() => directions.setVehicle(item.id)}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-[10px] px-1 py-2 text-[11px] font-semibold transition ${vehicle === item.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-ink'}`}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Hai ô điểm đi / điểm đến, nối bằng đường chấm. */}
      <div className="relative space-y-2.5 pl-5 pr-9">
        <span className="route-connector" aria-hidden="true" />
        <div className="relative">
          <span className="absolute -left-[20px] top-[17px] z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          <PlaceField
            getFocus={getSearchFocus}
            ariaLabel="Điểm xuất phát"
            placeholder="Điểm xuất phát"
            place={origin}
            onChange={directions.setOrigin}
          />
        </div>
        {directions.waypoints.map((item, index) => (
          <div key={item.key} className="relative">
            <span className="absolute -left-5 top-4 text-[10px] font-bold text-brand-600">{index + 1}</span>
            <PlaceField
              getFocus={getSearchFocus}
              ariaLabel={`Điểm dừng ${index + 1}`}
              placeholder={`Điểm dừng ${index + 1}`}
              place={item.place}
              onChange={(place) => directions.setWaypoint(item.key, place)}
            />
            <div className="mt-1 flex justify-end gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => directions.moveWaypoint(index, -1)}
                aria-label={`Đưa điểm dừng ${index + 1} lên trước`}
                className="px-2 text-xs text-slate-500 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === directions.waypoints.length - 1}
                onClick={() => directions.moveWaypoint(index, 1)}
                aria-label={`Đưa điểm dừng ${index + 1} xuống sau`}
                className="px-2 text-xs text-slate-500 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => directions.removeWaypoint(item.key)}
                aria-label={`Xóa điểm dừng ${index + 1}`}
                className="px-2 text-[10px] text-slate-500"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
        <div className="relative">
          <span className="absolute -left-[20px] top-[17px] z-10 h-2.5 w-2.5 rounded-[3px] border-2 border-white bg-brand-500 shadow-sm" />
          <PlaceField
            getFocus={getSearchFocus}
            ariaLabel="Điểm đến"
            placeholder="Bạn muốn đi đâu?"
            place={destination}
            onChange={directions.setDestination}
          />
        </div>
        <button
          type="button"
          disabled={!origin || !destination}
          onClick={directions.swap}
          className="absolute right-0 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-40"
          aria-label="Đảo chiều điểm đi và điểm đến"
          title="Đảo chiều"
        >
          <Icon name="swap" size={17} />
        </button>
      </div>

      <button
        type="button"
        disabled={directions.waypoints.length >= 8}
        onClick={directions.addWaypoint}
        className="mt-2 ml-5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 disabled:opacity-40"
      >
        <Icon name="plus" size={14} />
        Thêm điểm dừng
      </button>
      {directions.waypoints.length > 0 && (
        <p className="mt-1 pl-5 text-[10px] text-slate-500">
          Đi theo thứ tự trên. Muốn tự sắp xếp tốt nhất, dùng Nhiều điểm.
        </p>
      )}

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Tùy chọn tuyến
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/70 p-1"
          role="group"
          aria-label="Tiêu chí tìm tuyến"
        >
          {(
            [
              ['time', 'Nhanh nhất'],
              ['distance', 'Ngắn nhất'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={objective === id}
              onClick={() => directions.setObjective(id)}
              className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${objective === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={avoidFerry}
            onClick={() => directions.setAvoidFerry(!avoidFerry)}
            className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition ${avoidFerry ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200'}`}
          >
            {avoidFerry ? '✓ ' : ''}Tránh phà
          </button>
          <button
            type="button"
            disabled
            title="VietMap hiện chưa hỗ trợ loại trừ cao tốc trong API tuyến đang dùng."
            className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[10px] font-medium text-slate-400"
          >
            Tránh cao tốc · chưa hỗ trợ
          </button>
        </div>
      </div>
      {/* Cách chọn điểm khác: GPS hoặc click trên bản đồ. */}
      <div className="mt-3 flex flex-wrap gap-1.5 pl-5">
        <QuickAction
          icon="current-location"
          label={isLocating ? 'Đang định vị…' : 'Vị trí của tôi'}
          disabled={isLocating}
          onClick={onUseMyLocation}
        />
        <QuickAction
          icon="pin"
          label="Chọn điểm đi"
          active={pickTarget === 'origin'}
          onClick={() => onPickOnMap('origin')}
        />
        <QuickAction
          icon="pin"
          label="Chọn điểm đến"
          active={pickTarget === 'destination'}
          onClick={() => onPickOnMap('destination')}
        />
      </div>

      <div className="sticky bottom-0 z-20 -mx-5 mt-3 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-1 pt-3">
        <button
          type="button"
          disabled={!canCalculate}
          onClick={() => void directions.calculate()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[13px] font-bold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {isLoading ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
          ) : (
            <Icon name="route" size={18} />
          )}
          {isLoading ? 'Đang lấy tuyến đường…' : 'Tìm đường'}
        </button>
      </div>

      {error && (
        <p
          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900"
          role="alert"
        >
          {error}
        </p>
      )}

      {routeOptions.length > 0 && route && (
        <RouteOptionsList routes={routeOptions} selectedId={route.id} onSelect={directions.chooseRoute} />
      )}

      {route && (
        <RouteResultCard
          route={route}
          onSave={onSave}
          onStart={() => onStartNavigation(route)}
          isNavigating={isNavigating}
        />
      )}

      {directions.waypoints.length === 0 && (
        <details className="mt-3 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
            So sánh Dijkstra / A*
          </summary>
          <AlgorithmComparison
            comparison={comparison}
            canRun={Boolean(origin && destination) && origin?.id !== destination?.id}
          />
        </details>
      )}

      {!route && (
        <div className="route-note mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-[10px] leading-[1.6] text-slate-500">
          <Icon name="compass" size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <p>Tuyến VietMap theo phương tiện và tùy chọn đã chọn. Thời gian là ước tính.</p>
        </div>
      )}
    </FloatingPanel>
  );
}

function RouteOptionsList({
  routes,
  selectedId,
  onSelect,
}: {
  routes: NonNullable<DirectionsController['route']>[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const fastestDuration = Math.min(...routes.map((item) => item.durationMin));
  const shortestDistance = Math.min(...routes.map((item) => item.distanceKm));
  const primaryRoute = routes[0];

  return (
    <section className="mt-4" aria-label="Các tuyến đường thay thế">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold text-ink">Các tuyến có thể đi</h3>
        <span className="text-[9px] text-slate-400">{routes.length} phương án từ VietMap</span>
      </div>
      <div className="space-y-1.5">
        {routes.map((item) => {
          const deltaMinutes = Math.round(item.durationMin - (primaryRoute?.durationMin ?? fastestDuration));
          const isFastest = item.durationMin === fastestDuration;
          const isPrimary = item.id === primaryRoute?.id;
          const timeLabel = isPrimary
            ? isFastest
              ? 'Nhanh nhất'
              : 'Tuyến đề xuất'
            : Math.abs(deltaMinutes) <= 1
              ? 'Cùng thời gian'
              : deltaMinutes < 0
                ? `Nhanh hơn ${Math.abs(deltaMinutes)} phút`
                : `Chậm hơn ${deltaMinutes} phút`;
          const isShortest = item.distanceKm === shortestDistance;
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-brand-300 bg-brand-50/70 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-200'}`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${selected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {routes.indexOf(item) + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-ink">{Math.round(item.durationMin)} phút</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${isFastest ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {timeLabel}
                  </span>
                  {!isPrimary && isFastest && (
                    <span className="text-[8px] font-semibold text-emerald-700">Nhanh nhất</span>
                  )}
                  {isShortest && <span className="text-[8px] font-semibold text-brand-700">Ngắn nhất</span>}
                </span>
                <span className="mt-0.5 block text-[9px] text-slate-500">
                  {item.distanceKm.toFixed(1)} km
                  {item.tollCostVnd !== undefined
                    ? ` · phí ${new Intl.NumberFormat('vi-VN').format(item.tollCostVnd)} ₫`
                    : ''}
                </span>
              </span>
              {selected && <span className="text-[9px] font-bold text-brand-700">Đang chọn</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type QuickActionProps = {
  icon: 'current-location' | 'pin';
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/** Nút nhỏ dạng "chip" bên dưới hai ô nhập. */
function QuickAction({ icon, label, active = false, disabled = false, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition disabled:opacity-60 ${active ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700'}`}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
