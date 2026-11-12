import { useState } from 'react';
import { Popover } from '../../../app/layout/Popover';
import { SheetPanel } from '../../../app/layout/SheetPanel';
import { Icon } from '../../../shared/components/Icon';
import type { TrafficMapLayer } from '../../map/layers/trafficMapLayer';
import type { RoutePlan } from '../../map/types';
import { PlaceField } from '../../places/components/PlaceField';
import type { LatLng } from '../../places/types';
import { routeTrafficSeverity } from '../../traffic/services/routeTraffic';
import type { AlgorithmComparisonController } from '../hooks/useAlgorithmComparison';
import type { DirectionsController } from '../hooks/useDirections';
import { useModeDurations } from '../hooks/useModeDurations';
import { AlgorithmComparison } from './AlgorithmComparison';
import { DepartureSelect } from './DepartureSelect';
import { minutesSlowerThanFastest, routeLabels } from '../utils/routeLabels';
import { RouteOptionCard } from './RouteOptionCard';
import { RouteShareBar } from './RouteShareBar';
import { TravelModeTabs } from './TravelModeTabs';

/** Ô nào đang chờ người dùng chọn điểm trên bản đồ. */
export type PickTarget = 'origin' | 'destination';

type RoutePanelProps = {
  getSearchFocus?: () => LatLng;
  directions: DirectionsController;
  /** So sánh Dijkstra / A* trên cùng điểm đi/đến (không cần key VietMap). */
  comparison: AlgorithmComparisonController;
  /** Sự cố giao thông để tô màu thời gian từng phương án. */
  trafficLayer: TrafficMapLayer;
  pickTarget: PickTarget | null;
  isLocating: boolean;
  onPickOnMap: (target: PickTarget) => void;
  onUseMyLocation: () => void;
  onSave: () => void;
  onStartNavigation: (route: RoutePlan) => void;
  /** Chọn tuyến rồi zoom bản đồ vừa tuyến đó. */
  onPreviewRoute: (route: RoutePlan) => void;
  /** "+ Thêm điểm đến": chuyển sang luồng nhiều điểm với điểm đi/đến hiện tại. */
  onAddDestination: () => void;
  isNavigating: boolean;
  onClose: () => void;
};

const chipClass = (active: boolean) =>
  `inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400/50' : 'bg-white/70 text-ink ring-black/10 hover:bg-white dark:hover:bg-slate-700/60 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15'}`;

/** Panel chỉ đường A → B. Mọi trạng thái nằm trong hook useDirections, panel chỉ hiển thị. */
export function RoutePanel({
  getSearchFocus,
  directions,
  comparison,
  trafficLayer,
  pickTarget,
  isLocating,
  onPickOnMap,
  onUseMyLocation,
  onSave,
  onStartNavigation,
  onPreviewRoute,
  onAddDestination,
  isNavigating,
  onClose,
}: RoutePanelProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { origin, destination, vehicle, objective, avoidFerry, route, routeOptions, isLoading, error } =
    directions;
  const durations = useModeDurations(directions);
  const canCalculate =
    Boolean(origin && destination) &&
    directions.waypoints.every((item) => item.place) &&
    (origin?.id !== destination?.id || directions.waypoints.length > 0) &&
    !isLoading;
  const maxDuration = Math.max(...routeOptions.map((item) => item.durationMin), 1);
  const optionCount = (objective === 'distance' ? 1 : 0) + (avoidFerry ? 1 : 0);

  const footer = route ? (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStartNavigation(route)}
          disabled={isNavigating}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 text-sm font-bold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-indigo-400/40 active:scale-[.98] disabled:bg-none disabled:bg-emerald-600"
        >
          <Icon name={isNavigating ? 'check' : 'directions'} size={17} />
          {isNavigating ? 'Đang dẫn đường' : 'Bắt đầu'}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-4 text-sm font-semibold text-ink ring-1 ring-black/10 transition hover:bg-white dark:hover:bg-slate-700/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:scale-[.98] dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
        >
          <Icon name="bookmark" size={16} />
          Lưu
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        GPS chỉ bật khi bạn nhấn Bắt đầu. Thời gian là ước tính và có thể đổi theo giao thông.
      </p>
    </div>
  ) : (
    <button
      type="button"
      disabled={!canCalculate}
      onClick={() => void directions.calculate()}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 text-sm font-bold text-white shadow-md shadow-indigo-900/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:focus-visible:ring-indigo-400/40 active:scale-[.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
    >
      {isLoading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      ) : (
        <Icon name="route" size={17} />
      )}
      {isLoading ? 'Đang lấy tuyến đường…' : 'Tìm đường'}
    </button>
  );

  return (
    <SheetPanel eyebrow="Lộ trình" title="Chỉ đường" icon="directions" onClose={onClose} footer={footer}>
      <TravelModeTabs vehicle={vehicle} durations={durations} onSelect={directions.setVehicle} />

      {/* Khối điểm đi / điểm đến nối bằng đường chấm dọc. */}
      <div className="relative mt-3 rounded-3xl bg-black/[.04] p-2.5 pl-8 pr-12 dark:bg-white/5">
        <span className="route-connector" aria-hidden="true" />
        <div className="space-y-2">
          <div className="relative">
            <span
              className="absolute -left-[22px] top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-[3px] border-brand-600 bg-white dark:border-brand-300 dark:bg-slate-900"
              aria-hidden="true"
            />
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
              <span
                className="absolute -left-[24px] top-1/2 z-10 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-brand-600 text-[11px] font-bold leading-none text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <PlaceField
                getFocus={getSearchFocus}
                ariaLabel={`Điểm dừng ${index + 1}`}
                placeholder={`Điểm dừng ${index + 1}`}
                place={item.place}
                onChange={(place) => directions.setWaypoint(item.key, place)}
              />
              <div className="mt-1 flex justify-end gap-1 text-xs">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => directions.moveWaypoint(index, -1)}
                  aria-label={`Đưa điểm dừng ${index + 1} lên trước`}
                  className="h-7 rounded-full px-2.5 text-ink-soft hover:bg-black/5 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === directions.waypoints.length - 1}
                  onClick={() => directions.moveWaypoint(index, 1)}
                  aria-label={`Đưa điểm dừng ${index + 1} xuống sau`}
                  className="h-7 rounded-full px-2.5 text-ink-soft hover:bg-black/5 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => directions.removeWaypoint(item.key)}
                  aria-label={`Xóa điểm dừng ${index + 1}`}
                  className="h-7 rounded-full px-2.5 font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          <div className="relative">
            <Icon
              name="pin"
              size={20}
              className="absolute -left-[26px] top-1/2 z-10 -translate-y-1/2 fill-red-500/20 text-red-500"
            />
            <PlaceField
              getFocus={getSearchFocus}
              ariaLabel="Điểm đến"
              placeholder="Bạn muốn đi đâu?"
              place={destination}
              onChange={directions.setDestination}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={!origin || !destination}
          onClick={directions.swap}
          className="absolute right-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-ink-soft shadow-md ring-1 ring-black/10 dark:ring-white/10 transition hover:text-brand-700 dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 active:rotate-180 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
          aria-label="Đảo chiều điểm đi và điểm đến"
          title="Đảo chiều"
        >
          <Icon name="swap" size={17} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={directions.waypoints.length >= 8}
          onClick={directions.addWaypoint}
          className={chipClass(false)}
        >
          <Icon name="plus" size={13} />
          Thêm điểm dừng
        </button>
        <button
          type="button"
          disabled={!origin && !destination}
          onClick={onAddDestination}
          className={chipClass(false)}
          title="Lập hành trình nhiều điểm với điểm đi và đến hiện tại"
        >
          <Icon name="multi-stop" size={13} />
          Thêm điểm đến
        </button>
        <button type="button" disabled={isLocating} onClick={onUseMyLocation} className={chipClass(false)}>
          <Icon name="current-location" size={13} />
          {isLocating ? 'Đang định vị…' : 'Vị trí của tôi'}
        </button>
        <button
          type="button"
          aria-pressed={pickTarget === 'origin'}
          onClick={() => onPickOnMap('origin')}
          className={chipClass(pickTarget === 'origin')}
        >
          <Icon name="pin" size={13} />
          Chọn điểm đi
        </button>
        <button
          type="button"
          aria-pressed={pickTarget === 'destination'}
          onClick={() => onPickOnMap('destination')}
          className={chipClass(pickTarget === 'destination')}
        >
          <Icon name="pin" size={13} />
          Chọn điểm đến
        </button>
      </div>
      {directions.waypoints.length > 0 && (
        <p className="mt-1.5 pl-1 text-xs text-ink-soft dark:text-slate-400">
          Đi theo thứ tự trên. Muốn tự sắp xếp tốt nhất, dùng Nhiều điểm.
        </p>
      )}

      <div className="mt-3 flex items-start justify-between gap-2">
        <DepartureSelect durationMin={route ? route.durationMin : null} />
        <Popover
          open={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          label="Tùy chọn tuyến"
          panelClassName="right-0 top-full mt-1.5 w-64"
          className="shrink-0"
          trigger={
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={optionsOpen}
              onClick={() => setOptionsOpen((current) => !current)}
              className={chipClass(optionCount > 0)}
            >
              <Icon name="filter" size={13} />
              Tùy chọn{optionCount > 0 ? ` (${optionCount})` : ''}
            </button>
          }
        >
          <p className="mb-1.5 text-xs font-bold text-ink dark:text-white">Ưu tiên tuyến</p>
          <div
            className="grid grid-cols-2 gap-1 rounded-2xl bg-black/[.05] p-1 dark:bg-white/10"
            role="radiogroup"
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
                role="radio"
                aria-checked={objective === id}
                onClick={() => directions.setObjective(id)}
                className={`rounded-xl px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 ${objective === id ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200' : 'text-ink-soft dark:text-slate-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={avoidFerry}
            onClick={() => directions.setAvoidFerry(!avoidFerry)}
            className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-xs font-medium text-ink hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:text-slate-100 dark:hover:bg-white/10"
          >
            Tránh phà
            <span
              className={`relative h-5 w-9 rounded-full transition ${avoidFerry ? 'bg-brand-gradient' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-slate-800/60 shadow transition-all ${avoidFerry ? 'left-[18px]' : 'left-0.5'}`}
              />
            </span>
          </button>
          <p
            className="mt-1 px-2 text-[11px] text-ink-soft dark:text-slate-400"
            title="VietMap hiện chưa hỗ trợ loại trừ cao tốc trong API tuyến đang dùng."
          >
            Tránh cao tốc: chưa hỗ trợ
          </p>
        </Popover>
      </div>

      {origin && destination && (
        <div className="mt-2">
          <RouteShareBar origin={origin} destination={destination} vehicle={vehicle} />
        </div>
      )}

      {error && (
        <p
          className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-400/10 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:text-amber-100 ring-1 ring-amber-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {routeOptions.length > 0 && route && (
        <section className="mt-4" aria-label="Các tuyến có thể đi">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink dark:text-white">Các tuyến có thể đi</h3>
            <span className="text-xs text-ink-soft dark:text-slate-400">{routeOptions.length} phương án</span>
          </div>
          <ul className="space-y-2.5" aria-live="polite">
            {routeOptions.map((item) => (
              <RouteOptionCard
                key={item.id}
                route={item}
                labels={routeLabels(item, routeOptions)}
                deltaMinutes={minutesSlowerThanFastest(item, routeOptions)}
                maxDurationMin={maxDuration}
                severity={routeTrafficSeverity(item, trafficLayer)}
                selected={item.id === route.id}
                onSelect={() => directions.chooseRoute(item.id)}
                onPreview={() => onPreviewRoute(item)}
              />
            ))}
          </ul>
        </section>
      )}

      {directions.waypoints.length === 0 && (
        <details className="group mt-4 rounded-2xl bg-black/[.04] px-3 py-2 dark:bg-white/5">
          <summary className="cursor-pointer list-none text-xs font-semibold text-ink-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 dark:focus-visible:ring-indigo-400/40 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="chevron-right" size={13} className="transition group-open:rotate-90" />
              Nâng cao: so sánh Dijkstra / A*
            </span>
          </summary>
          <div className="pt-2">
            <AlgorithmComparison
              comparison={comparison}
              canRun={Boolean(origin && destination) && origin?.id !== destination?.id}
            />
          </div>
        </details>
      )}

      {!route && (
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-ink-soft dark:text-slate-400">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          Tuyến VietMap theo phương tiện và tùy chọn đã chọn. Thời gian là ước tính.
        </p>
      )}
    </SheetPanel>
  );
}
