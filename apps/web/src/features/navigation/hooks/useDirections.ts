import { useRef, useState } from 'react';
import type { RoutePlan, TransportMode } from '../../map/types';
import type { Place } from '../../places/types';
import type { RouteApiClient } from '../services/RouteApiClient';

type UseDirectionsOptions = {
  routeApi: RouteApiClient;
  /** Tuyến đang vẽ trên bản đồ (do App giữ, vì panel nhiều điểm/đã lưu cũng dùng). */
  activeRoute: RoutePlan | null;
  /** Báo cho App vẽ tuyến mới, hoặc xóa tuyến (null). */
  onRouteChange: (route: RoutePlan | null) => void;
  initialOrigin: Place | null;
  initialDestination: Place | null;
};

/** Bộ 3 thông tin đủ để tính một tuyến. */
type RouteQuery = { origin: Place | null; destination: Place | null; vehicle: TransportMode };

/**
 * Quản lý trạng thái panel "Chỉ đường": điểm đi, điểm đến, loại xe và việc gọi API tính tuyến.
 * - Đổi điểm đi/đến: xóa tuyến cũ (vì không còn đúng).
 * - Đổi loại xe khi đang có tuyến: tự tính lại tuyến cho xe mới.
 */
export function useDirections({ routeApi, activeRoute, onRouteChange, initialOrigin, initialDestination }: UseDirectionsOptions) {
  const [origin, setOriginState] = useState<Place | null>(initialOrigin);
  const [destination, setDestinationState] = useState<Place | null>(initialDestination);
  const [vehicle, setVehicleState] = useState<TransportMode>('motorcycle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Đếm số lần gọi API: chỉ nhận kết quả của lần gọi mới nhất, bỏ kết quả về muộn.
  const latestRequest = useRef(0);

  // Tuyến đang hiển thị chỉ được coi là "của panel này" khi khớp điểm đi/đến và loại xe.
  const route = activeRoute?.kind === 'route'
    && activeRoute.vehicle === vehicle
    && activeRoute.stops[0]?.id === origin?.id
    && activeRoute.stops[1]?.id === destination?.id
    ? activeRoute
    : null;

  const calculate = async (query: RouteQuery = { origin, destination, vehicle }): Promise<RoutePlan | null> => {
    if (!query.origin || !query.destination) {
      setError('Hãy chọn điểm đi và điểm đến.');
      return null;
    }
    if (query.origin.id === query.destination.id) {
      setError('Điểm đi và điểm đến đang trùng nhau.');
      return null;
    }

    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError('');
    onRouteChange(null);
    const result = await routeApi.createPlan([query.origin, query.destination], query.vehicle);
    if (requestId !== latestRequest.current) return null; // đã có yêu cầu mới hơn
    setIsLoading(false);

    if ('error' in result) {
      setError(result.error);
      return null;
    }
    onRouteChange(result);
    return result;
  };

  /** Xóa tuyến cũ (nếu có) vì điểm đi/đến vừa thay đổi. */
  const clearRoute = () => {
    setError('');
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
    setVehicleState(next);
    setError('');
    if (route) void calculate({ origin, destination, vehicle: next });
  };

  /** Đảo chiều điểm đi ↔ điểm đến; nếu đang có tuyến thì tính lại chiều ngược. */
  const swap = () => {
    setOriginState(destination);
    setDestinationState(origin);
    setError('');
    if (route) void calculate({ origin: destination, destination: origin, vehicle });
  };

  /** Đặt cùng lúc điểm đi, điểm đến, loại xe rồi tính tuyến (dùng khi mở lại tuyến đã lưu). */
  const open = (query: RouteQuery) => {
    setOriginState(query.origin);
    setDestinationState(query.destination);
    setVehicleState(query.vehicle);
    return calculate(query);
  };

  return { origin, destination, vehicle, route, isLoading, error, setOrigin, setDestination, setVehicle, swap, calculate, open };
}

/** Kiểu dữ liệu trả về của hook, dùng cho props của RoutePanel. */
export type DirectionsController = ReturnType<typeof useDirections>;
