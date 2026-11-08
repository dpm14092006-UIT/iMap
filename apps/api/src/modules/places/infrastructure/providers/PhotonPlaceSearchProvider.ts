import type { PlaceSuggestion } from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { GeoFocus, PlaceSearchProvider } from '../../application/ports/PlaceSearchProvider.js';

type PhotonFeature = {
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry?: { coordinates?: unknown[] };
};

type PhotonResponse = { features?: PhotonFeature[] };

/** Tâm TP.HCM, dùng làm điểm ưu tiên khi client không gửi vị trí. */
const HCMC_CENTER: GeoFocus = { lat: 10.779, lng: 106.701 };
/** Số gợi ý tối đa trả về cho ô tìm kiếm (theo backlog: 5–8 kết quả). */
const SUGGESTION_LIMIT = 7;
const TIMEOUT_MS = 7000;

/** Adapter giữ chi tiết của Photon/OSM bên ngoài tầng application. */
export class PhotonPlaceSearchProvider implements PlaceSearchProvider {
  constructor(private readonly baseUrl = 'https://photon.komoot.io') {}

  async suggest(query: string, focus: GeoFocus = HCMC_CENTER): Promise<PlaceSuggestion[]> {
    const params = new URLSearchParams({ q: query, limit: String(SUGGESTION_LIMIT), lat: String(focus.lat), lon: String(focus.lng) });
    const payload = await this.request(`/api/?${params}`);
    return (payload.features ?? []).flatMap((feature) => this.toSuggestion(feature) ?? []);
  }

  async reverse(point: GeoFocus): Promise<PlaceSuggestion | null> {
    const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), limit: '1' });
    const payload = await this.request(`/reverse?${params}`);
    const first = payload.features?.[0];
    return first ? this.toSuggestion(first) : null;
  }

  /** Gọi Photon với timeout và đổi lỗi mạng thành AppError thân thiện. */
  private async request(path: string): Promise<PhotonResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'Không thể kết nối dịch vụ tìm kiếm địa điểm');
    }
    if (!response.ok) throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'Dịch vụ tìm kiếm địa điểm đang bận');
    try {
      return await response.json() as PhotonResponse;
    } catch {
      throw new AppError(502, 'PLACE_SEARCH_INVALID_RESPONSE', 'Dịch vụ tìm kiếm trả về dữ liệu không hợp lệ');
    }
  }

  /** Chuyển một GeoJSON feature của Photon sang DTO dùng chung. Trả null nếu thiếu tọa độ. */
  private toSuggestion(feature: PhotonFeature): PlaceSuggestion | null {
    // Photon trả GeoJSON nên thứ tự là [lng, lat].
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;

    const place = feature.properties ?? {};
    // Tên ưu tiên: tên POI -> "số nhà + đường" -> thành phố.
    const streetLabel = [place.housenumber, place.street].filter(Boolean).join(' ');
    const name = place.name || streetLabel || place.city || 'Địa điểm';
    const address = [place.housenumber, place.street, place.district, place.city, place.state, place.country]
      .filter((value): value is string => Boolean(value?.trim()))
      .filter((value, index, values) => values.indexOf(value) === index) // bỏ phần trùng (vd. city = state)
      .join(', ');
    const identity = place.osm_type && place.osm_id ? `${place.osm_type}-${place.osm_id}` : `${lat.toFixed(5)}-${lng.toFixed(5)}`;
    return { id: `osm-${identity}`, name, address: address || 'OpenStreetMap', lat, lng };
  }
}
