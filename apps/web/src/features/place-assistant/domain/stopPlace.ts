import type { StopPlace } from '@routetwin/shared';
import type { Place } from '../../places/types';

/** Đổi địa điểm do trợ lý gợi ý sang kiểu Place dùng chung. */
export function placeFromStop(place: StopPlace): Place {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    lat: place.lat,
    lng: place.lng,
    source: 'osm',
  };
}
