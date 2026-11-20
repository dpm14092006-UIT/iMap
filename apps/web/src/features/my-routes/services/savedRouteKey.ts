import type { SavedRoute } from '../types';

/** Làm tròn tọa độ ~1 m để cùng một địa điểm luôn ra cùng khóa dù sai số dấu phẩy động. */
const coordinateKey = (place: { lat: number; lng: number }) =>
  `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;

/**
 * Khóa nhận biết "cùng một tuyến" khi lưu: loại tuyến + loại xe + tiêu chí + toàn bộ điểm dừng theo thứ tự.
 * Lưu lại đúng tuyến này thì thay bản cũ; khác xe, khác tiêu chí hay khác điểm ghé thì giữ cả hai.
 * (Trước đây so theo tiêu đề nên A→B ô tô bị A→B xe máy ghi đè.)
 */
export function savedRouteKey(route: SavedRoute): string {
  const stops = route.stops?.length
    ? route.stops
    : [route.origin, ...(route.destination ? [route.destination] : [])];
  const objective = route.plan?.objective ?? 'time';
  return [route.kind, route.vehicle, objective, ...stops.map(coordinateKey)].join('|');
}
