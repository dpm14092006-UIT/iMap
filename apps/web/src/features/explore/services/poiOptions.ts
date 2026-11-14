import type { Poi, PoiSort } from '../types';

export const poiSortLabels: Record<PoiSort, string> = {
  route: 'Theo tuyến',
  distance: 'Gần nhất',
  detour: 'Ít đi vòng nhất',
};

/** Với tìm quanh đây, "theo tuyến" không có nghĩa nên mặc định là gần nhất. */
export const poiSortsByMode = {
  nearby: ['distance'] as PoiSort[],
  alongRoute: ['route', 'distance', 'detour'] as PoiSort[],
};

export const poiRadiusOptions = [500, 1000, 1500, 2000, 3000, 5000] as const;
export const ALONG_ROUTE_RADIUS_M = 1500;

/** Bán kính tìm quanh đây theo mức zoom: ≥15 là 1 km, 13–14 là 3 km, xa hơn là 5 km. */
export function radiusForZoom(zoom: number): number {
  if (zoom >= 15) return 1000;
  if (zoom >= 13) return 3000;
  return 5000;
}

/** 500 -> "500 m", 1500 -> "1,5 km". */
export function formatRadius(radiusM: number, language: 'vi' | 'en' = 'vi'): string {
  return radiusM < 1000
    ? `${radiusM} m`
    : `${(radiusM / 1000).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 1 })} km`;
}

function referenceDistance(poi: Poi, mode: 'nearby' | 'alongRoute'): number {
  return mode === 'alongRoute' ? poi.distanceFromRouteM : (poi.distanceFromCenterM ?? 0);
}

/** Sắp xếp phía client (không gọi lại API): theo tuyến, gần nhất hoặc ít đi vòng nhất. */
export function sortPois(pois: Poi[], sort: PoiSort, mode: 'nearby' | 'alongRoute'): Poi[] {
  const sorted = [...pois];
  if (mode === 'nearby' || sort === 'distance')
    return sorted.sort((a, b) => referenceDistance(a, mode) - referenceDistance(b, mode));
  if (sort === 'detour')
    return sorted.sort((a, b) => a.detourMin - b.detourMin || a.distanceFromRouteM - b.distanceFromRouteM);
  return sorted.sort(
    (a, b) => a.positionAlongRouteM - b.positionAlongRouteM || a.distanceFromRouteM - b.distanceFromRouteM,
  );
}
