import type { NearbyPoiRequest, PoiResult } from '@routetwin/shared';
import { haversineMeters } from '../../domain/poi-geometry.js';
import { PoiLookup } from '../services/PoiLookup.js';
import type { PoiSearchProvider } from '../ports/PoiSearchProvider.js';
import { dedupeByCoordinates } from './poi-result.js';

/** Tìm địa điểm thật quanh một tâm (một điểm mẫu), xếp theo khoảng cách tới tâm. */
export class SearchPoisNearbyUseCase {
  private readonly lookup: PoiLookup;

  constructor(provider: PoiSearchProvider) {
    this.lookup = new PoiLookup(provider);
  }

  async execute(request: NearbyPoiRequest): Promise<PoiResult[]> {
    const center = { lat: request.lat, lng: request.lng };
    const found = await this.lookup.find([center], request, request.radiusM, request.limit);
    const results = found
      .map((poi): PoiResult => {
        const distance = Math.round(haversineMeters(center, poi));
        return {
          ...poi,
          distanceFromRouteM: 0,
          positionAlongRouteM: 0,
          detourMin: 0,
          distanceFromCenterM: distance,
        };
      })
      .filter((poi) => poi.distanceFromCenterM! <= request.radiusM)
      .sort((a, b) => a.distanceFromCenterM! - b.distanceFromCenterM!);
    return dedupeByCoordinates(results);
  }
}
