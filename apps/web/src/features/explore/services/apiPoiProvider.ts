import type { AlongRoutePoiRequest } from '@routetwin/shared';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';
import type { Coordinate } from '../../map/types';
import type { LatLng } from '../../places/types';
import type { Poi, PoiProvider, PoiSearchTerm } from '../types';
import { simplifyPath } from './simplifyPath';

/** Chỉ gửi trường có giá trị để body/query không chứa `undefined`. */
function termFields(term: PoiSearchTerm): {
  query?: string;
  category?: NonNullable<PoiSearchTerm['category']>;
} {
  return {
    ...(term.query ? { query: term.query } : {}),
    ...(term.category ? { category: term.category } : {}),
  };
}

/** Địa điểm thật qua backend (VietMap): `POST /places/along-route` và `GET /places/nearby`. */
export class ApiPoiProvider implements PoiProvider {
  constructor(private readonly http: HttpClient = httpClient) {}

  nearby(center: LatLng, term: PoiSearchTerm, radiusM: number, signal?: AbortSignal): Promise<Poi[]> {
    const params = new URLSearchParams({
      lat: center.lat.toFixed(5),
      lng: center.lng.toFixed(5),
      radiusM: String(Math.round(radiusM)),
      ...termFields(term),
    });
    return this.http.get<Poi[]>(`/places/nearby?${params}`, signal ? { signal } : {});
  }

  alongRoute(path: Coordinate[], term: PoiSearchTerm, radiusM: number, signal?: AbortSignal): Promise<Poi[]> {
    const body: Omit<AlongRoutePoiRequest, 'limit'> = {
      path: simplifyPath(path),
      radiusM: Math.round(radiusM),
      ...termFields(term),
    };
    return this.http.post<Poi[]>('/places/along-route', body, signal ? { signal } : {});
  }
}
