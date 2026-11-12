import type { AlongRoutePoiRequest, PoiResult } from '@routetwin/shared';
import {
  detourMinutes,
  projectOnPath,
  sampleAlongPath,
  type LatLngTuple,
} from '../../domain/poi-geometry.js';
import { PoiLookup } from '../services/PoiLookup.js';
import type { PoiSearchProvider } from '../ports/PoiSearchProvider.js';
import { dedupeByCoordinates } from './poi-result.js';

/** Tìm địa điểm thật dọc theo một tuyến: lấy mẫu điểm, tìm quanh từng điểm, rồi tính vị trí/độ lệch so với tuyến. */
export class SearchPoisAlongRouteUseCase {
  private readonly lookup: PoiLookup;

  constructor(provider: PoiSearchProvider) {
    this.lookup = new PoiLookup(provider);
  }

  async execute(request: AlongRoutePoiRequest): Promise<PoiResult[]> {
    const path: LatLngTuple[] = request.path;
    const samples = sampleAlongPath(path, request.radiusM);
    const found = await this.lookup.find(samples, request, request.radiusM, request.limit);
    const results = found
      .map((poi): PoiResult => {
        const projection = projectOnPath(poi, path);
        return {
          ...poi,
          distanceFromRouteM: Math.round(projection.distanceM),
          positionAlongRouteM: Math.round(projection.alongM),
          detourMin: detourMinutes(projection.distanceM),
        };
      })
      .filter((poi) => poi.distanceFromRouteM <= request.radiusM)
      .sort(
        (a, b) =>
          a.positionAlongRouteM - b.positionAlongRouteM || a.distanceFromRouteM - b.distanceFromRouteM,
      );
    return dedupeByCoordinates(results);
  }
}
