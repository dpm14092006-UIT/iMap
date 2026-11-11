import type { PlaceSuggestion } from '@routetwin/shared';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';
import type { LatLng, Place, PlaceSearchSuggestion } from '../types';

/** Client gọi module `places` của backend (VietMap). */
export class PlaceApiClient {
  constructor(private readonly http: HttpClient) {}

  /** Gợi ý địa điểm theo từ khóa, ưu tiên khu vực quanh `focus`. */
  async suggest(
    query: string,
    focus: LatLng,
    signal?: AbortSignal,
    kind: 'all' | 'street' = 'all',
  ): Promise<PlaceSearchSuggestion[]> {
    const params = new URLSearchParams({ q: query, lat: String(focus.lat), lng: String(focus.lng), kind });
    const data = await this.http.get<PlaceSuggestion[]>(`/places/suggest?${params}`, { signal });
    return data.map((suggestion) => this.toSuggestion(suggestion));
  }

  /** Lấy tọa độ cho gợi ý chưa có (mỗi gợi ý chỉ cần một lần gọi chi tiết). */
  async resolve(suggestion: PlaceSearchSuggestion, signal?: AbortSignal): Promise<Place> {
    if (typeof suggestion.lat === 'number' && typeof suggestion.lng === 'number') {
      return { ...suggestion, lat: suggestion.lat, lng: suggestion.lng };
    }
    const params = new URLSearchParams({ id: suggestion.id });
    const data = await this.http.get<PlaceSuggestion>(`/places/details?${params}`, { signal });
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') {
      throw new Error('Địa điểm chưa có tọa độ. Hãy chọn kết quả khác.');
    }
    // Giữ tên POI đã chọn: bản chi tiết đôi khi chỉ có địa chỉ đường.
    return { ...suggestion, address: data.address || suggestion.address, lat: data.lat, lng: data.lng };
  }

  /** Reverse geocoding: tọa độ -> địa điểm gần nhất (null nếu không có). */
  async reverse(point: LatLng, signal?: AbortSignal): Promise<Place | null> {
    const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
    const data = await this.http.get<PlaceSuggestion | null>(`/places/reverse?${params}`, { signal });
    return data && typeof data.lat === 'number' && typeof data.lng === 'number'
      ? { ...this.toSuggestion(data), lat: data.lat, lng: data.lng }
      : null;
  }

  /** Đổi DTO từ backend sang kiểu Place của frontend. */
  private toSuggestion(suggestion: PlaceSuggestion): PlaceSearchSuggestion {
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
}

export const placeApi = new PlaceApiClient(httpClient);
