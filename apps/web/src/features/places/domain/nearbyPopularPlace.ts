import type { LatLng } from '../../../shared/geo/types';
import type { Place } from '../types';
import { popularPlaces } from './popularPlaces';

/** Khoảng cách (độ) tối đa để coi một click là "chọn" địa điểm gợi ý gần đó (~200 m). */
const PLACE_CLICK_TOLERANCE = 0.002;

/** Địa điểm gợi ý gần điểm click nhất, hoặc null nếu không có điểm nào đủ gần. */
export function findPopularPlaceNear(point: LatLng, places: readonly Place[] = popularPlaces): Place | null {
  return (
    places.find(
      (place) =>
        Math.abs(place.lat - point.lat) < PLACE_CLICK_TOLERANCE &&
        Math.abs(place.lng - point.lng) < PLACE_CLICK_TOLERANCE,
    ) ?? null
  );
}
