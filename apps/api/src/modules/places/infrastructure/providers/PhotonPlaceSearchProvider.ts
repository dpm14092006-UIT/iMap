import type { PlaceSuggestion } from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { PlaceSearchProvider } from '../../application/ports/PlaceSearchProvider.js';

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

/** Adapter that keeps Photon/OSM details out of the application layer. */
export class PhotonPlaceSearchProvider implements PlaceSearchProvider {
  constructor(private readonly endpoint = 'https://photon.komoot.io/api/') {}

  async suggest(query: string, focus = { lat: 10.779, lng: 106.701 }): Promise<PlaceSuggestion[]> {
    const params = new URLSearchParams({ q: query, limit: '7', lat: String(focus.lat), lon: String(focus.lng) });
    let response: Response;
    try {
      response = await fetch(`${this.endpoint}?${params}`, { signal: AbortSignal.timeout(7000) });
    } catch {
      throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'Không thể kết nối dịch vụ tìm kiếm địa điểm');
    }
    if (!response.ok) throw new AppError(502, 'PLACE_SEARCH_UNAVAILABLE', 'Dịch vụ tìm kiếm địa điểm đang bận');
    const payload = await response.json() as PhotonResponse;
    return (payload.features ?? []).flatMap((feature): PlaceSuggestion[] => {
      const coordinates = feature.geometry?.coordinates;
      const lng = coordinates?.[0];
      const lat = coordinates?.[1];
      if (typeof lat !== 'number' || typeof lng !== 'number') return [];
      const place = feature.properties ?? {};
      const name = place.name ?? place.street ?? place.city ?? 'Địa điểm';
      const address = [place.housenumber, place.street, place.district, place.city, place.state, place.country]
        .filter((value): value is string => Boolean(value?.trim()))
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(', ');
      const identity = place.osm_type && place.osm_id ? `${place.osm_type}-${place.osm_id}` : `${lat.toFixed(5)}-${lng.toFixed(5)}`;
      return [{ id: `osm-${identity}`, name, address: address || 'OpenStreetMap', lat, lng }];
    });
  }
}
