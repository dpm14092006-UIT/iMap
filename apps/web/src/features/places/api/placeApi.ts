import type { PlaceSuggestion } from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';
import type { LatLng, Place } from '../types';

/** Đổi DTO từ backend sang kiểu Place của frontend. */
function toPlace(suggestion: PlaceSuggestion): Place | null {
  if (typeof suggestion.lat !== 'number' || typeof suggestion.lng !== 'number') return null;
  return {
    id: suggestion.id,
    name: suggestion.name,
    address: suggestion.address,
    category: 'Địa chỉ',
    lat: suggestion.lat,
    lng: suggestion.lng,
    source: 'osm',
  };
}

/** Client gọi module `places` của backend (Photon / OpenStreetMap). */
export const placeApi = {
  /** Gợi ý địa điểm theo từ khóa, ưu tiên khu vực quanh `focus`. */
  async suggest(query: string, focus: LatLng, signal?: AbortSignal): Promise<Place[]> {
    const params = new URLSearchParams({ q: query, lat: String(focus.lat), lng: String(focus.lng) });
    const data = await apiRequest<PlaceSuggestion[]>(`/places/suggest?${params}`, { signal });
    return data.flatMap((item) => toPlace(item) ?? []);
  },

  /** Reverse geocoding: tọa độ -> địa điểm gần nhất (null nếu không có). */
  async reverse(point: LatLng, signal?: AbortSignal): Promise<Place | null> {
    const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
    const data = await apiRequest<PlaceSuggestion | null>(`/places/reverse?${params}`, { signal });
    return data ? toPlace(data) : null;
  },
};
