import type { PlaceSuggestion } from '@routetwin/shared';
import type { GeoFocus, PlaceSearchProvider } from '../ports/PlaceSearchProvider.js';

/** Đổi một tọa độ (ví dụ điểm người dùng click trên bản đồ) thành tên/địa chỉ dễ đọc. */
export class ReverseGeocodeUseCase {
  constructor(private readonly provider: PlaceSearchProvider) {}

  execute(point: GeoFocus): Promise<PlaceSuggestion | null> {
    return this.provider.reverse(point);
  }
}
