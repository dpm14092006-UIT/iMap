import type {
  CompareRoutesRequest,
  OptimizeRouteRequest,
  OptimizeRouteResult,
  RouteComparisonResult,
  RouteComparisonSnapshot,
  RouteResult,
} from '@routetwin/shared';
import { ApiError } from '../../../shared/api/ApiError';
import type { HttpClient, RequestOptions } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';
import type { Place } from '../../places/types';
import type { RouteObjective, RoutePlan, TransportMode } from '../types';

/** Kết quả gọi API tuyến đường: tuyến hợp lệ hoặc thông báo lỗi để hiển thị cho người dùng. */
export type RoutePlanResult = RoutePlan | { error: string };

type RouteRequestBody = {
  points: { lat: number; lng: number }[];
  vehicle: TransportMode;
  objective: 'distance' | 'duration';
  returnToStart?: boolean;
  algorithm?: OptimizeRouteRequest['algorithm'];
  alternatives?: boolean;
  avoid?: 'ferry'[];
};

export type DirectionsComparison = Omit<RouteComparisonSnapshot, 'routes'> & {
  routes: (RouteComparisonSnapshot['routes'][number] & { planId: string })[];
};

export type RoutePlansResult = { routes: RoutePlan[]; comparison?: DirectionsComparison } | { error: string };

function requestBody(stops: Place[], vehicle: TransportMode, objective: RouteObjective): RouteRequestBody {
  return {
    points: stops.map(({ lat, lng }) => ({ lat, lng })),
    vehicle,
    // Frontend gọi tiêu chí là "time", API gọi là "duration".
    objective: objective === 'distance' ? 'distance' : 'duration',
  };
}

/** Lỗi do máy chủ trả về thì dùng thông báo của máy chủ; lỗi kết nối thì dùng `fallback`. */
function toError(cause: unknown, fallback: string): { error: string } {
  return { error: cause instanceof ApiError && cause.isServerError ? cause.message : fallback };
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
  private comparisonSessionId?: string;
  constructor(private readonly http: HttpClient = httpClient) {}

  /** Tối ưu thứ tự ghé các điểm (giữ cố định điểm đầu) rồi trả tuyến theo thứ tự mới. */
  async createOptimizedPlan(
    stops: Place[],
    vehicle: TransportMode,
    objective: RouteObjective,
    returnToStart: boolean,
    algorithm: OptimizeRouteRequest['algorithm'] = 'auto',
  ): Promise<RoutePlanResult> {
    try {
      const data = await this.http.post<OptimizeRouteResult>('/routes/optimize', {
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
    avoidFerry = false,
  ): Promise<RoutePlanResult> {
    if (stops.length < 2) return { error: 'Chọn ít nhất điểm đi và điểm đến.' };
    try {
      const data = await this.http.post<RouteResult>('/routes/calculate', {
        ...requestBody(stops, vehicle, objective),
        ...(avoidFerry ? { avoid: ['ferry'] } : {}),
      });
      if (!Array.isArray(data?.coordinates) || data.coordinates.length < 2) {
        return { error: 'Dịch vụ chỉ đường trả về tuyến không hợp lệ.' };
      }
      return routePlanFromResult(data, stops, vehicle, objective, avoidFerry);
    } catch (cause) {
      return toError(cause, 'Không kết nối được máy chủ chỉ đường. Hãy thử lại sau ít phút.');
    }
  }

  /** Tính nhiều phương án cho hai điểm, có thể yêu cầu VietMap tránh phà. */
  async createPlans(
    stops: Place[],
    vehicle: TransportMode,
    objective: RouteObjective = 'time',
    avoidFerry = false,
  ): Promise<RoutePlansResult> {
    if (stops.length < 2) return { error: 'Chọn ít nhất điểm đi và điểm đến.' };
    try {
      const comparisonSessionId =
        stops.length === 2 ? (this.comparisonSessionId ??= crypto.randomUUID()) : undefined;
      const data = await this.http.post<RouteResult>('/routes/calculate', {
        ...requestBody(stops, vehicle, objective),
        alternatives: true,
        ...(comparisonSessionId ? { comparisonSessionId } : {}),
        ...(avoidFerry ? { avoid: ['ferry'] } : {}),
      });
      const allPaths = [data, ...(data.alternatives ?? [])];
      const candidates = allPaths.filter(
        (path) => Array.isArray(path.coordinates) && path.coordinates.length >= 2,
      );
      if (!candidates.length) return { error: 'Dịch vụ chỉ đường trả về tuyến không hợp lệ.' };

      // VietMap có thể trả cùng một hình học lặp lại; gộp để danh sách gọn và dễ so sánh.
      const unique = candidates.filter((path, index) => {
        const next = candidates.findIndex(
          (candidate) =>
            candidate.distanceMeters === path.distanceMeters &&
            candidate.durationSeconds === path.durationSeconds &&
            candidate.coordinates.length === path.coordinates.length &&
            candidate.coordinates.every(
              ([lng, lat], coordinateIndex) =>
                path.coordinates[coordinateIndex]?.[0] === lng &&
                path.coordinates[coordinateIndex]?.[1] === lat,
            ),
        );
        return next === index;
      });
      const routes = unique.map((path) => routePlanFromResult(path, stops, vehicle, objective, avoidFerry));
      const comparison = data.comparison;
      if (
        comparisonSessionId &&
        comparison?.routes.length === allPaths.length &&
        unique.length === allPaths.length
      ) {
        return {
          routes,
          comparison: {
            ...comparison,
            routes: comparison.routes.map((facts, index) => ({ ...facts, planId: routes[index]!.id })),
          },
        };
      }
      return { routes };
    } catch (cause) {
      return toError(cause, 'Không kết nối được máy chủ chỉ đường. Hãy thử lại sau ít phút.');
    }
  }

  compare = (
    snapshot: string,
    preference: CompareRoutesRequest['preference'],
    options: RequestOptions,
  ): Promise<RouteComparisonResult> => {
    return this.http.post<RouteComparisonResult>(
      '/routes/compare',
      { snapshot, sessionId: this.comparisonSessionId, preference },
      options,
    );
  };
}

/** Đổi kết quả tuyến của API (mét, giây, GeoJSON) sang RoutePlan để vẽ và hiển thị (km, phút, tọa độ [vĩ độ, kinh độ]). */
export function routePlanFromResult(
  result: RouteResult,
  stops: Place[],
  vehicle: TransportMode,
  objective: RouteObjective = 'time',
  avoidFerry = false,
): RoutePlan {
  const leg = {
    nodes: stops.map((place) => place.id),
    // API trả GeoJSON [kinh độ, vĩ độ]; ứng dụng dùng [vĩ độ, kinh độ].
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
    ...(result.tollCostVnd === undefined ? {} : { tollCostVnd: result.tollCostVnd }),
    ...(result.variant === undefined ? {} : { variant: result.variant }),
    ...(result.congestion === undefined ? {} : { congestion: result.congestion }),
    ...(avoidFerry ? { avoidFerry: true } : {}),
  };
}
