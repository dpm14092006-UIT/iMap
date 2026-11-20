import type { Place } from '../../places/types';
import { poiMetaFor } from './poiCatalog';
import type { Poi } from '../types';

/** Địa điểm thật (POI) dưới dạng Place dùng chung cho chi tiết, chỉ đường và điểm dừng. */
export function placeFromPoi(poi: Poi): Place {
  return {
    id: poi.id,
    name: poi.name,
    address: poi.address,
    category: poiMetaFor(poi.category).label,
    lat: poi.lat,
    lng: poi.lng,
    source: 'poi',
  };
}
