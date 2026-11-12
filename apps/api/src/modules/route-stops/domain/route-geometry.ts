import { EARTH_RADIUS_METERS, haversineMeters } from '../../../shared/geo/haversine.js';
import type { StopBounds } from '../application/ports/StopPlaceProvider.js';
type Coordinate = [number, number]; // [longitude, latitude]
const EARTH_RADIUS = EARTH_RADIUS_METERS;
const radians = (value: number) => (value * Math.PI) / 180;
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  return haversineMeters({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });
}
/** Local equirectangular projection. Used only to shortlist urban POIs, never as driving distance. */
export function projectOnRoute(point: Coordinate, coordinates: Coordinate[]) {
  let bestDistance = Infinity;
  let bestProgress = 0;
  let progress = 0;
  const xScale = ((Math.cos(radians(point[1])) * Math.PI) / 180) * EARTH_RADIUS;
  const yScale = (Math.PI / 180) * EARTH_RADIUS;
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1]!;
    const b = coordinates[i]!;
    const ax = (a[0] - point[0]) * xScale;
    const ay = (a[1] - point[1]) * yScale;
    const dx = (b[0] - a[0]) * xScale;
    const dy = (b[1] - a[1]) * yScale;
    const denominator = dx * dx + dy * dy;
    const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    const length = distanceMeters(a, b);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = progress + t * length;
    }
    progress += length;
  }
  return { distance: bestDistance, progress: bestProgress };
}
export function routeBounds(coordinates: Coordinate[], radiusMeters: number): StopBounds {
  const lats = coordinates.map((point) => point[1]);
  const lngs = coordinates.map((point) => point[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const latPadding = radiusMeters / 111000;
  const lngPadding = latPadding / Math.max(0.2, Math.cos(radians((minLat + maxLat) / 2)));
  return {
    south: minLat - latPadding,
    north: maxLat + latPadding,
    west: Math.min(...lngs) - lngPadding,
    east: Math.max(...lngs) + lngPadding,
  };
}
