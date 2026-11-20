import type { LatLng } from '../../../shared/geo/types';
/** Coordinate tolerance of approximately 0.1 m. */
export function isSamePoint(a: LatLng, b: LatLng) {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}
