import type { TransportMode } from '../../map/types';
import { formatCoordinates } from '../../places/services/placeFromPoint';
import type { Place } from '../../places/types';

export type SharedRoute = { origin: Place; destination: Place; vehicle: TransportMode };

const vehicles: TransportMode[] = ['car', 'motorcycle'];

/** "lat,lng,tên" — tên có thể chứa dấu phẩy nên chỉ tách hai dấu phẩy đầu. */
function encodePoint(place: Place): string {
  return `${place.lat.toFixed(6)},${place.lng.toFixed(6)},${place.name}`;
}

function decodePoint(value: string | null, role: 'origin' | 'destination'): Place | null {
  if (!value) return null;
  const [rawLat, rawLng, ...nameParts] = value.split(',');
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!rawLat || !rawLng || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const point = { lat, lng };
  return {
    id: `shared-${role}-${lat.toFixed(6)}-${lng.toFixed(6)}`,
    name: nameParts.join(',').trim() || (role === 'origin' ? 'Điểm đi' : 'Điểm đến'),
    address: formatCoordinates(point),
    category: 'Điểm được chia sẻ',
    lat,
    lng,
    source: 'map',
  };
}

/** Liên kết mở thẳng tuyến: `?from=lat,lng,tên&to=lat,lng,tên&mode=car`. */
export function buildRouteShareUrl(route: SharedRoute, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('from', encodePoint(route.origin));
  url.searchParams.set('to', encodePoint(route.destination));
  url.searchParams.set('mode', route.vehicle);
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
  };
}
