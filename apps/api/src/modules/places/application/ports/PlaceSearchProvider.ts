import type { PlaceSuggestion } from '@routetwin/shared';

export type GeoFocus = { lat: number; lng: number };

/** Port tìm kiếm địa điểm. Use case chỉ biết interface này, không biết Photon hay VietMap. */
export interface PlaceSearchProvider {
  /** Gợi ý địa điểm theo từ khóa, ưu tiên kết quả gần `focus`. */
  suggest(query: string, focus?: GeoFocus): Promise<PlaceSuggestion[]>;
  resolve?(id: string): Promise<PlaceSuggestion>;
  /** Reverse geocoding: tìm địa điểm/địa chỉ gần nhất với một tọa độ. Trả null nếu không có. */
  reverse(point: GeoFocus): Promise<PlaceSuggestion | null>;
}
