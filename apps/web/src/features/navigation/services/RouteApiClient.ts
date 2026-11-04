import type { RouteResult } from '@routetwin/shared';
import type { DemoPlace, RouteObjective, RoutePlan, TransportMode } from '../../map/types';

type RouteApiError = { error?: { message?: string } };

/** Client boundary for the API's VietMap-backed route calculation. */
export class RouteApiClient {
  async createPlan(stops: DemoPlace[], vehicle: TransportMode, objective: RouteObjective = 'time'): Promise<RoutePlan | { error: string }> {
    if (stops.length < 2) return { error: 'Chọn ít nhất điểm đi và điểm đến.' };
    if (vehicle !== 'car' && vehicle !== 'motorcycle') {
      return { error: 'Dịch vụ định tuyến hiện hỗ trợ ô tô và xe máy.' };
    }

    let response: Response;
    try {
      response = await fetch('/api/routes/calculate', {
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

    const first = stops[0]!;
    const last = stops[stops.length - 1]!;
    const leg = {
      nodes: stops.map((place) => place.id),
      // API data is GeoJSON [longitude, latitude]; Leaflet consumes [latitude, longitude].
      points: payload.data.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      distanceKm: payload.data.distanceMeters / 1000,
      durationMin: payload.data.durationSeconds / 60,
      from: first,
      to: last,
      instructions: payload.data.instructions,
    };
    return {
      id: `vietmap-${Date.now()}`,
      kind: stops.length > 2 ? 'multi' : 'route',
      stops,
      legs: [leg],
      distanceKm: leg.distanceKm,
      durationMin: leg.durationMin,
      vehicle,
      objective,
    };
  }
}
