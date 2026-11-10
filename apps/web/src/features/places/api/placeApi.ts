import type { PlaceSuggestion } from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';
import type { LatLng, Place, PlaceSearchSuggestion } from '../types';

/** Đổi DTO từ backend sang kiểu Place của frontend. */
function toSuggestion(suggestion: PlaceSuggestion): PlaceSearchSuggestion {
  return {
    id: suggestion.id,
    name: suggestion.name,
    address: suggestion.address,
    category: 'Địa chỉ',
    lat: suggestion.lat,
    lng: suggestion.lng,
    source: suggestion.source ?? 'osm',
  };
}

/** Client gọi module `places` của backend (VietMap). */
export const placeApi = {
  /** Gợi ý địa điểm theo từ khóa, ưu tiên khu vực quanh `focus`. */
  async suggest(query: string, focus: LatLng, signal?: AbortSignal, kind: 'all' | 'street' = 'all'): Promise<PlaceSearchSuggestion[]> {
    const params = new URLSearchParams({ q: query, lat: String(focus.lat), lng: String(focus.lng), kind });
    const data = await apiRequest<PlaceSuggestion[]>(`/places/suggest?${params}`, { signal });
    return data.map(toSuggestion);
  },

  async resolve(suggestion: PlaceSearchSuggestion, signal?: AbortSignal): Promise<Place> {
    if (typeof suggestion.lat === 'number' && typeof suggestion.lng === 'number') return { ...suggestion, lat: suggestion.lat, lng: suggestion.lng };
    const params = new URLSearchParams({ id: suggestion.id });
    const data = await apiRequest<PlaceSuggestion>(`/places/details?${params}`, { signal });
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') throw new Error('Địa điểm chưa có tọa độ. Hãy chọn kết quả khác.');
    // Keep the selected POI name: detail records sometimes only contain a street address.
    return { ...suggestion, address: data.address || suggestion.address, lat: data.lat, lng: data.lng };
  },

  /** Reverse geocoding: tọa độ -> địa điểm gần nhất (null nếu không có). */
  async reverse(point: LatLng, signal?: AbortSignal): Promise<Place | null> {
    const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
    const data = await apiRequest<PlaceSuggestion | null>(`/places/reverse?${params}`, { signal });
    return data && typeof data.lat === 'number' && typeof data.lng === 'number' ? { ...toSuggestion(data), lat: data.lat, lng: data.lng } : null;
  },
};
