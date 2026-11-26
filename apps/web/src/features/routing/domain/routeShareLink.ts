import { isInVietmapCoverage } from '@routetwin/shared';
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

const defaultNames = {
  origin: 'Điểm đi',
  destination: 'Điểm đến',
  via: 'Điểm ghé',
  place: 'Địa điểm',
} as const;
type PointRole = keyof typeof defaultNames;

/** Tọa độ trong link: chỉ số thập phân thường (không hex "0x..", số mũ "1e1", Infinity). */
const plainDecimal = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
/** Tên điểm đến từ link do người khác soạn: giới hạn độ dài để không chứa được cả một đoạn văn. */
export const MAX_SHARED_NAME_LENGTH = 80;
const controlChars = /\p{Cc}+/gu;

function sanitizeSharedName(raw: string): string {
  const cleaned = raw.replace(controlChars, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(cleaned).slice(0, MAX_SHARED_NAME_LENGTH).join('').trim();
}

/** "lat,lng,tên" — tên có thể chứa dấu phẩy nên chỉ tách hai dấu phẩy đầu. */
function encodePoint(place: Pick<Place, 'lat' | 'lng' | 'name'>): string {
  return `${place.lat.toFixed(6)},${place.lng.toFixed(6)},${place.name}`;
}

function decodePoint(value: string | null, role: PointRole, index = 0): Place | null {
  if (!value) return null;
  const [rawLat = '', rawLng = '', ...nameParts] = value.split(',');
  if (!plainDecimal.test(rawLat.trim()) || !plainDecimal.test(rawLng.trim())) return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const point = { lat, lng };
  // Ngoài vùng VietMap thì không tính được tuyến: bỏ cả link thay vì tự gọi API rồi báo lỗi.
  if (!isInVietmapCoverage(point)) return null;
  return {
    id: `shared-${role}${role === 'via' ? `-${index}` : ''}-${lat.toFixed(6)}-${lng.toFixed(6)}`,
    name: sanitizeSharedName(nameParts.join(',')) || defaultNames[role],
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

/** Các tham số link của iMap (tuyến và địa điểm); tham số khác trên URL được giữ nguyên. */
const LINK_PARAMS = ['from', 'to', 'mode', 'via', 'by', 'ferry', 'place'] as const;

/** Liên kết mở thẳng một địa điểm: `?place=lat,lng,tên`. */
export function buildPlaceShareUrl(place: Pick<Place, 'lat' | 'lng' | 'name'>, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('place', encodePoint(place));
  return url.toString();
}

/** Đọc `?place=…`; null nếu không có hoặc sai (cùng quy tắc với điểm của link tuyến). */
export function parsePlaceShareLink(search: string): Place | null {
  return decodePoint(new URLSearchParams(search).get('place'), 'place');
}

/** Thứ đang xem, để thanh địa chỉ phản ánh và gửi thẳng được cho người khác. */
export type AddressBarState =
  | { kind: 'route'; route: SharedRoute }
  | { kind: 'place'; place: Pick<Place, 'lat' | 'lng' | 'name'> }
  | { kind: 'none' };

/** URL tương ứng với thứ đang xem; `none` chỉ bỏ các tham số của iMap, giữ đường dẫn và tham số khác. */
export function addressBarUrl(state: AddressBarState, current: string): string {
  if (state.kind === 'route') return buildRouteShareUrl(state.route, current);
  if (state.kind === 'place') return buildPlaceShareUrl(state.place, current);
  const url = new URL(current);
  for (const name of LINK_PARAMS) url.searchParams.delete(name);
  return url.toString();
}
