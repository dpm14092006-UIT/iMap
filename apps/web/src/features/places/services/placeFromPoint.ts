import type { LatLng } from '../../../shared/geo/types';
import { placeApi } from '../api/placeApi';
import { basicPlaceFromPoint, type PointSource } from '../domain/pointPlace';
import type { Place } from '../types';

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
