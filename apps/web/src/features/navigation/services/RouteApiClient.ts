import type { OptimizeRouteRequest, OptimizeRouteResult, RouteResult } from '@routetwin/shared';
import type { RouteObjective, RoutePlan, TransportMode } from '../../map/types';
import type { Place } from '../../places/types';

type RouteApiError = { error?: { message?: string } };

/** Client boundary for the API's VietMap-backed route calculation. */
export class RouteApiClient {
  /** Gọi /routes/optimize: sắp xếp thứ tự ghé (Held–Karp hoặc NN + 2-opt) rồi tính tuyến thật. */
  async createOptimizedPlan(stops: Place[], vehicle: TransportMode, objective: RouteObjective, returnToStart: boolean, algorithm: OptimizeRouteRequest['algorithm'] = 'auto'): Promise<RoutePlan | { error: string }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/routes/optimize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: stops.map(({ lat, lng }) => ({ lat, lng })), vehicle, objective: objective === 'distance' ? 'distance' : 'duration', returnToStart, algorithm }),
      });
      const payload = await response.json() as { data?: OptimizeRouteResult } & RouteApiError;
      if (!response.ok) return { error: payload.error?.message ?? 'Không tối ưu được hành trình.' };
      const data = payload.data;
      if (!data || data.order.some((index) => !Number.isInteger(index) || !stops[index]) || data.order.length !== stops.length + (returnToStart ? 1 : 0) || new Set(data.order).size !== stops.length || data.order[0] !== 0 || (returnToStart && data.order.at(-1) !== 0)) return { error: 'Thứ tự tối ưu trả về không hợp lệ.' };
      const plan = routePlanFromResult(data.route, data.order.map((index) => stops[index]!), vehicle, objective);
      return { ...plan, optimization: { algorithm: data.algorithm, originalCost: data.originalCost, optimizedCost: data.optimizedCost, objective: data.objective } };
    } catch { return { error: 'Không kết nối được dịch vụ tối ưu hành trình. Hãy thử lại.' }; }
  }

  async createPlan(stops: Place[], vehicle: TransportMode, objective: RouteObjective = 'time'): Promise<RoutePlan | { error: string }> {
    if (stops.length < 2) return { error: 'Chọn ít nhất điểm đi và điểm đến.' };
    if (vehicle !== 'car' && vehicle !== 'motorcycle') {
      return { error: 'Dịch vụ định tuyến hiện hỗ trợ ô tô và xe máy.' };
    }

    let response: Response;
    try {
      response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/routes/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: stops.map(({ lat, lng }) => ({ lat, lng })),
          vehicle,
          objective: objective === 'distance' ? 'distance' : 'duration',
        }),
      });
    } catch {
      return { error: 'Không kết nối được máy chủ chỉ đường. Hãy kiểm tra API đang chạy.' };
    }

    const payload = await response.json().catch(() => null) as ({ data?: RouteResult } & RouteApiError) | null;
    if (!response.ok) return { error: payload?.error?.message ?? 'Không thể tính tuyến lúc này. Hãy thử lại.' };
    if (!payload?.data || !Array.isArray(payload.data.coordinates) || payload.data.coordinates.length < 2) {
      return { error: 'Dịch vụ chỉ đường trả về tuyến không hợp lệ.' };
    }

    return routePlanFromResult(payload.data, stops, vehicle, objective);
  }
}


export function routePlanFromResult(result: RouteResult, stops: Place[], vehicle: TransportMode, objective: RouteObjective = 'time'): RoutePlan {
    const first = stops[0]!;
    const last = stops[stops.length - 1]!;
    const leg = {
      nodes: stops.map((place) => place.id),
      // API data is GeoJSON [longitude, latitude]; Leaflet consumes [latitude, longitude].
      points: result.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      distanceKm: result.distanceMeters / 1000,
      durationMin: result.durationSeconds / 60,
      from: first,
      to: last,
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
