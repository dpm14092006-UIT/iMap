/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_METERS = 6_371_008.8;

type GeoPoint = { lat: number; lng: number };
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. Radius is explicit for legacy datasets and spherical models. */
export function haversineMeters(a: GeoPoint, b: GeoPoint, radius = EARTH_RADIUS_METERS): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}
