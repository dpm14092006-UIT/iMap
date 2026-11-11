import type { OptimizeRouteRequest, OptimizeRouteResult, RouteResult } from '@routetwin/shared';
import { ApiError, apiRequest } from '../../../shared/api/httpClient';
import type { RouteObjective, RoutePlan, TransportMode } from '../../map/types';
import type { Place } from '../../places/types';

/** Kết quả gọi API tuyến đường: tuyến hợp lệ hoặc thông báo lỗi để hiển thị cho người dùng. */
export type RoutePlanResult = RoutePlan | { error: string };

type RouteRequestBody = {
  points: { lat: number; lng: number }[];
  vehicle: TransportMode;
  objective: 'distance' | 'duration';
  returnToStart?: boolean;
  algorithm?: OptimizeRouteRequest['algorithm'];
};

function requestBody(stops: Place[], vehicle: TransportMode, objective: RouteObjective): RouteRequestBody {
  return {
    points: stops.map(({ lat, lng }) => ({ lat, lng })),
    vehicle,
    // Frontend gọi tiêu chí là "time", API gọi là "duration".
    objective: objective === 'distance' ? 'distance' : 'duration',
  };
}

function postRoute<T>(endpoint: string, body: RouteRequestBody): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
}

/** Lỗi do máy chủ trả về thì dùng thông báo của máy chủ; lỗi kết nối thì dùng `fallback`. */
function toError(cause: unknown, fallback: string): { error: string } {
  return { error: cause instanceof ApiError && cause.status > 0 ? cause.message : fallback };
}

/** Thứ tự tối ưu hợp lệ khi bắt đầu từ điểm 0 và ghé mỗi điểm đúng một lần (thêm 0 ở cuối nếu quay về). */
function isValidOrder(order: number[], stopCount: number, returnToStart: boolean): boolean {
  return (
    order.every((index) => Number.isInteger(index) && index >= 0 && index < stopCount) &&
    order.length === stopCount + (returnToStart ? 1 : 0) &&
    new Set(order).size === stopCount &&
    order[0] === 0 &&
    (!returnToStart || order.at(-1) === 0)
  );
}

/** Client gọi các endpoint tính tuyến của backend (VietMap). */
export class RouteApiClient {
  /** Tối ưu thứ tự ghé các điểm (giữ cố định điểm đầu) rồi trả tuyến theo thứ tự mới. */
  async createOptimizedPlan(
    stops: Place[],
    vehicle: TransportMode,
    objective: RouteObjective,
    returnToStart: boolean,
    algorithm: OptimizeRouteRequest['algorithm'] = 'auto',
  ): Promise<RoutePlanResult> {
    try {
      const data = await postRoute<OptimizeRouteResult>('/routes/optimize', {
        ...requestBody(stops, vehicle, objective),
        returnToStart,
        algorithm,
      });
      if (!Array.isArray(data?.order) || !isValidOrder(data.order, stops.length, returnToStart)) {
        return { error: 'Thứ tự tối ưu trả về không hợp lệ.' };
      }
      const plan = routePlanFromResult(
        data.route,
        data.order.map((index) => stops[index]!),
        vehicle,
        objective,
      );
      return {
        ...plan,
        optimization: {
          algorithm: data.algorithm,
          originalCost: data.originalCost,
          optimizedCost: data.optimizedCost,
          objective: data.objective,
        },
      };
    } catch (cause) {
      return toError(cause, 'Không kết nối được dịch vụ tối ưu hành trình. Hãy thử lại.');
    }
  }

  /** Tính tuyến đi qua các điểm theo đúng thứ tự đã cho. */
  async createPlan(
    stops: Place[],
    vehicle: TransportMode,
    objective: RouteObjective = 'time',
  ): Promise<RoutePlanResult> {
    if (stops.length < 2) return { error: 'Chọn ít nhất điểm đi và điểm đến.' };
    try {
      const data = await postRoute<RouteResult>('/routes/calculate', requestBody(stops, vehicle, objective));
      if (!Array.isArray(data?.coordinates) || data.coordinates.length < 2) {
        return { error: 'Dịch vụ chỉ đường trả về tuyến không hợp lệ.' };
      }
      return routePlanFromResult(data, stops, vehicle, objective);
    } catch (cause) {
      return toError(cause, 'Không kết nối được máy chủ chỉ đường. Hãy thử lại sau ít phút.');
    }
  }
}

/** Đổi kết quả tuyến của API (mét, giây, GeoJSON) sang RoutePlan để vẽ và hiển thị (km, phút, Leaflet). */
export function routePlanFromResult(
  result: RouteResult,
  stops: Place[],
  vehicle: TransportMode,
  objective: RouteObjective = 'time',
): RoutePlan {
  const leg = {
    nodes: stops.map((place) => place.id),
    // API trả GeoJSON [kinh độ, vĩ độ]; Leaflet dùng [vĩ độ, kinh độ].
    points: result.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    distanceKm: result.distanceMeters / 1000,
    durationMin: result.durationSeconds / 60,
    from: stops[0]!,
    to: stops[stops.length - 1]!,
    instructions: result.instructions,
  };
  return {
    id: `vietmap-${crypto.randomUUID()}`,
    kind: stops.length > 2 ? 'multi' : 'route',
    stops,
    legs: [leg],
    distanceKm: leg.distanceKm,
    durationMin: leg.durationMin,
    vehicle,
    objective,
  };
}
