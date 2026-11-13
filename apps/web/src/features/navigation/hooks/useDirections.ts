import { useRef, useState } from 'react';
import type { RouteObjective, RoutePlan, TransportMode } from '../../map/types';
import type { Place } from '../../places/types';
import type { RouteApiClient } from '../services/RouteApiClient';

type UseDirectionsOptions = {
  routeApi: RouteApiClient;
  /** Tuyến đang vẽ trên bản đồ (do App giữ, vì panel nhiều điểm/đã lưu cũng dùng). */
  activeRoute: RoutePlan | null;
  /** Báo cho App vẽ tuyến mới, hoặc xóa tuyến (null). */
  onRouteChange: (route: RoutePlan | null) => void;
};

/** Bộ 3 thông tin đủ để tính một tuyến. */
type RouteQuery = {
  origin: Place | null;
  destination: Place | null;
  vehicle: TransportMode;
  via?: (Place | null)[];
  objective?: RouteObjective;
  avoidFerry?: boolean;
};
type Waypoint = { key: string; place: Place | null };

/**
 * Quản lý trạng thái panel "Chỉ đường": điểm đi, điểm đến, loại xe và việc gọi API tính tuyến.
 * - Đổi điểm đi/đến: xóa tuyến cũ (vì không còn đúng).
 * - Đổi loại xe khi đang có tuyến: tự tính lại tuyến cho xe mới.
 */
export function useDirections({ routeApi, activeRoute, onRouteChange }: UseDirectionsOptions) {
  const [origin, setOriginState] = useState<Place | null>(null);
  const [destination, setDestinationState] = useState<Place | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [vehicle, setVehicleState] = useState<TransportMode>('motorcycle');
  const [objective, setObjectiveState] = useState<RouteObjective>('time');
  const [avoidFerry, setAvoidFerryState] = useState(false);
  const [routeOptions, setRouteOptions] = useState<RoutePlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Đếm số lần gọi API: chỉ nhận kết quả của lần gọi mới nhất, bỏ kết quả về muộn.
  const latestRequest = useRef(0);

  // Tuyến đang hiển thị chỉ được coi là "của panel này" khi khớp điểm đi/đến và loại xe.
  const expectedStops = [origin, ...waypoints.map((item) => item.place), destination];
  const route =
    activeRoute &&
    activeRoute.vehicle === vehicle &&
    activeRoute.stops.length === expectedStops.length &&
    expectedStops.every((place, index) => place && activeRoute.stops[index]?.id === place.id)
      ? activeRoute
      : null;

  const calculate = async (
    query: RouteQuery = {
      origin,
      destination,
      vehicle,
      via: waypoints.map((item) => item.place),
      objective,
      avoidFerry,
    },
  ): Promise<RoutePlan | null> => {
    if (!query.origin || !query.destination) {
      setError('Hãy chọn điểm đi và điểm đến.');
      return null;
    }
    if (query.via?.some((place) => !place)) {
      setError('Hãy chọn địa điểm cho tất cả điểm dừng hoặc xóa ô còn trống.');
      return null;
    }
    if (query.origin.id === query.destination.id && !query.via?.length) {
      setError('Điểm đi và điểm đến đang trùng nhau.');
      return null;
    }

    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError('');
    setRouteOptions([]);
    onRouteChange(null);
    const result = await routeApi.createPlans(
      [query.origin, ...((query.via ?? []) as Place[]), query.destination],
      query.vehicle,
      query.objective ?? objective,
      query.avoidFerry ?? avoidFerry,
    );
    if (requestId !== latestRequest.current) return null; // đã có yêu cầu mới hơn
    setIsLoading(false);

    if ('error' in result) {
      setError(result.error);
      return null;
    }
    setRouteOptions(result.routes);
    onRouteChange(result.routes[0]!);
    return result.routes[0]!;
  };

  /** Xóa tuyến cũ (nếu có) vì điểm đi/đến vừa thay đổi. */
  const clearRoute = () => {
    latestRequest.current++;
    setIsLoading(false);
    setError('');
    setRouteOptions([]);
    if (route) onRouteChange(null);
  };

  const setOrigin = (place: Place | null) => {
    setOriginState(place);
    clearRoute();
  };

  const setDestination = (place: Place | null) => {
    setDestinationState(place);
    clearRoute();
  };

  const setVehicle = (next: TransportMode) => {
    if (next === vehicle) return;
    clearRoute();
    setVehicleState(next);
    if (route)
      void calculate({
        origin,
        destination,
        vehicle: next,
        via: waypoints.map((item) => item.place),
        objective,
        avoidFerry,
      });
  };

  const setObjective = (next: RouteObjective) => {
    if (next === objective) return;
    clearRoute();
    setObjectiveState(next);
  };

  const setAvoidFerry = (next: boolean) => {
    if (next === avoidFerry) return;
    clearRoute();
    setAvoidFerryState(next);
  };

  const chooseRoute = (id: string) => {
    const selected = routeOptions.find((item) => item.id === id);
    if (selected) onRouteChange(selected);
  };

  /** Đảo chiều điểm đi ↔ điểm đến; nếu đang có tuyến thì tính lại chiều ngược. */
  const swap = () => {
    clearRoute();
    setWaypoints((current) => [...current].reverse());
    setOriginState(destination);
    setDestinationState(origin);
    setError('');
    if (route)
      void calculate({
        origin: destination,
        destination: origin,
        vehicle,
        via: [...waypoints].reverse().map((item) => item.place),
        objective,
        avoidFerry,
      });
  };

  /** Đặt cùng lúc điểm đi, điểm đến, loại xe rồi tính tuyến (dùng khi mở lại tuyến đã lưu). */
  const open = (query: RouteQuery) => {
    setWaypoints((query.via ?? []).map((place) => ({ key: crypto.randomUUID(), place })));
    setOriginState(query.origin);
    setDestinationState(query.destination);
    setVehicleState(query.vehicle);
    if (query.objective) setObjectiveState(query.objective);
    if (query.avoidFerry !== undefined) setAvoidFerryState(query.avoidFerry);
    return calculate(query);
  };

  const addWaypoint = () => {
    if (waypoints.length >= 8) return;
    clearRoute();
    setWaypoints((current) => [...current, { key: crypto.randomUUID(), place: null }]);
  };
  const setWaypoint = (key: string, place: Place | null) => {
    clearRoute();
    setWaypoints((current) => current.map((item) => (item.key === key ? { ...item, place } : item)));
  };
  const removeWaypoint = (key: string) => {
    clearRoute();
    setWaypoints((current) => current.filter((item) => item.key !== key));
  };
  const moveWaypoint = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= waypoints.length) return;
    clearRoute();
    setWaypoints((current) => {
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next]!, copy[index]!];
      return copy;
    });
  };
  return {
    waypoints,
    addWaypoint,
    setWaypoint,
    removeWaypoint,
    moveWaypoint,
    origin,
    destination,
    vehicle,
    objective,
    avoidFerry,
    route,
    routeOptions,
    isLoading,
    error,
    setOrigin,
    setDestination,
    setVehicle,
    setObjective,
    setAvoidFerry,
    chooseRoute,
    swap,
    calculate,
    open,
  };
}

/** Kiểu dữ liệu trả về của hook, dùng cho props của RoutePanel. */
export type DirectionsController = ReturnType<typeof useDirections>;
