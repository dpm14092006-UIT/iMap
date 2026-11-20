import type { LatLng } from '../../../shared/geo/types';
import type { Place, PlaceSource } from '../types';

/** Hiển thị tọa độ ngắn gọn, ví dụ "10.77210, 106.69830". */
export function formatCoordinates(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export type PointSource = Extract<PlaceSource, 'map' | 'gps'>;

/** Tạo ngay một Place từ tọa độ, chưa có tên đường (dùng tọa độ làm địa chỉ). */
export function basicPlaceFromPoint(point: LatLng, source: PointSource): Place {
  return {
    // id gắn với tọa độ để hai điểm khác nhau không bị coi là trùng.
    id: `${source}-${point.lat.toFixed(6)}-${point.lng.toFixed(6)}`,
    name: source === 'gps' ? 'Vị trí của tôi' : 'Điểm đã chọn trên bản đồ',
    address: formatCoordinates(point),
    category: source === 'gps' ? 'Vị trí hiện tại' : 'Điểm trên bản đồ',
    lat: point.lat,
    lng: point.lng,
    source,
  };
}
