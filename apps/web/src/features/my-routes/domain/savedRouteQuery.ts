import type { RouteObjective, TransportMode } from '../../routing/types';
import type { Place } from '../../places/types';
import type { SavedRoute } from '../types';

/** Toàn bộ điểm dừng theo thứ tự; dữ liệu cũ chỉ có điểm đi/đến. Ít hơn 2 điểm thì không mở lại được. */
export function savedRouteStops(saved: SavedRoute): Place[] {
  if (saved.stops && saved.stops.length > 1) return saved.stops;
  return saved.destination ? [saved.origin, saved.destination] : [];
}

/** Yêu cầu tính lại một tuyến chỉ đường đã lưu, giữ nguyên điểm ghé, tiêu chí và "tránh phà" như lúc lưu. */
export function savedRouteDirectionsQuery(saved: SavedRoute): {
  origin: Place;
  destination: Place;
  via: Place[];
  vehicle: TransportMode;
  objective: RouteObjective;
  avoidFerry: boolean;
} | null {
  const stops = savedRouteStops(saved);
  if (stops.length < 2) return null;
  return {
    origin: stops[0]!,
    destination: stops[stops.length - 1]!,
    via: stops.slice(1, -1),
    vehicle: saved.vehicle,
    objective: saved.objective ?? 'time',
    avoidFerry: saved.avoidFerry ?? false,
  };
}
