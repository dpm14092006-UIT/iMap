import { placeApi } from '../api/placeApi';
import type { LatLng, Place, PlaceSource } from '../types';

/** Hiển thị tọa độ ngắn gọn, ví dụ "10.77210, 106.69830". */
export function formatCoordinates(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

type PointSource = Extract<PlaceSource, 'map' | 'gps'>;

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

/**
 * Tạo một Place từ tọa độ (click bản đồ hoặc GPS).
 * Thử reverse geocoding để có tên đường dễ đọc; nếu lỗi thì dùng tọa độ làm địa chỉ,
 * để người dùng vẫn chỉ đường được khi dịch vụ tìm kiếm không phản hồi.
 */
export async function placeFromPoint(point: LatLng, source: PointSource): Promise<Place> {
  const base = basicPlaceFromPoint(point, source);
  try {
    const nearest = await placeApi.reverse(point);
    if (!nearest) return base;
    // GPS giữ tên "Vị trí của tôi" cho dễ hiểu, chỉ bổ sung địa chỉ.
    return source === 'gps'
      ? { ...base, address: nearest.address }
      : { ...base, name: nearest.name, address: nearest.address };
  } catch {
    return base;
  }
}
