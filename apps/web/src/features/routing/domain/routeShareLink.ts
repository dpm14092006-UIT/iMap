import { formatCoordinates } from '../../places/domain/pointPlace';
import type { Place } from '../../places/types';
import type { RouteObjective, TransportMode } from '../types';

export type SharedRoute = {
  origin: Place;
  destination: Place;
  vehicle: TransportMode;
  /** Điểm ghé giữa đường theo thứ tự. */
  via?: Place[];
  objective?: RouteObjective;
  avoidFerry?: boolean;
};

/** Giới hạn số điểm ghé đọc từ link (panel chỉ đường cho tối đa 8). */
const MAX_SHARED_VIA = 8;

const vehicles: TransportMode[] = ['car', 'motorcycle'];

const defaultNames = { origin: 'Điểm đi', destination: 'Điểm đến', via: 'Điểm ghé' } as const;

/** "lat,lng,tên" — tên có thể chứa dấu phẩy nên chỉ tách hai dấu phẩy đầu. */
function encodePoint(place: Place): string {
  return `${place.lat.toFixed(6)},${place.lng.toFixed(6)},${place.name}`;
}

function decodePoint(value: string | null, role: 'origin' | 'destination' | 'via', index = 0): Place | null {
  if (!value) return null;
  const [rawLat, rawLng, ...nameParts] = value.split(',');
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!rawLat || !rawLng || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const point = { lat, lng };
  return {
    id: `shared-${role}${role === 'via' ? `-${index}` : ''}-${lat.toFixed(6)}-${lng.toFixed(6)}`,
    name: nameParts.join(',').trim() || defaultNames[role],
    address: formatCoordinates(point),
    category: 'Điểm được chia sẻ',
    lat,
    lng,
    source: 'map',
  };
}

/**
 * Liên kết mở thẳng tuyến: `?from=lat,lng,tên&to=lat,lng,tên&mode=car`, kèm `via=…` (lặp lại, theo thứ tự),
 * `by=distance` khi chọn "ngắn nhất" và `ferry=avoid` khi tránh phà. Mặc định thì bỏ qua cho link gọn.
 */
export function buildRouteShareUrl(route: SharedRoute, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('from', encodePoint(route.origin));
  url.searchParams.set('to', encodePoint(route.destination));
  url.searchParams.set('mode', route.vehicle);
  for (const stop of route.via ?? []) url.searchParams.append('via', encodePoint(stop));
  if (route.objective === 'distance') url.searchParams.set('by', 'distance');
  if (route.avoidFerry) url.searchParams.set('ferry', 'avoid');
  return url.toString();
}

/** Đọc tham số liên kết chia sẻ; trả null nếu thiếu hoặc sai điểm đi/đến. */
export function parseRouteShareLink(search: string): SharedRoute | null {
  const params = new URLSearchParams(search);
  const origin = decodePoint(params.get('from'), 'origin');
  const destination = decodePoint(params.get('to'), 'destination');
  if (!origin || !destination) return null;
  const mode = params.get('mode');
  return {
    origin,
    destination,
    vehicle: vehicles.find((vehicle) => vehicle === mode) ?? 'motorcycle',
    // Điểm ghé hỏng thì bỏ qua thay vì làm hỏng cả link.
    via: params
      .getAll('via')
      .slice(0, MAX_SHARED_VIA)
      .map((value, index) => decodePoint(value, 'via', index))
      .filter((place): place is Place => place !== null),
    objective: params.get('by') === 'distance' ? 'distance' : 'time',
    avoidFerry: params.get('ferry') === 'avoid',
  };
}
