import type { RouteVariant } from '@routetwin/shared';

type RouteLike = { durationMin: number; distanceKm: number; variant?: RouteVariant };

export const variantLabels: Record<Exclude<RouteVariant, 'default'>, string> = {
  'avoid-toll': 'Tránh trạm thu phí',
  'avoid-motorway': 'Tránh cao tốc',
  'avoid-ferry': 'Tránh phà',
};

/** Nhãn của một phương án: Nhanh nhất / Ngắn nhất / lý do tồn tại (tránh trạm thu phí, cao tốc, phà). */
export function routeLabels(route: RouteLike, routes: RouteLike[]): string[] {
  const labels: string[] = [];
  const fastest = Math.min(...routes.map((item) => item.durationMin));
  const isFastest = route.durationMin === fastest;
  if (isFastest) labels.push('Nhanh nhất');
  if (
    !isFastest &&
    routes.length > 1 &&
    route.distanceKm === Math.min(...routes.map((item) => item.distanceKm))
  ) {
    labels.push('Ngắn nhất');
  }
  if (route.variant && route.variant !== 'default') labels.push(variantLabels[route.variant]);
  return labels;
}

/** Số phút chậm hơn phương án nhanh nhất (làm tròn); 0 nếu là phương án nhanh nhất. */
export function minutesSlowerThanFastest(route: RouteLike, routes: RouteLike[]): number {
  const fastest = Math.min(...routes.map((item) => item.durationMin));
  return Math.max(0, Math.round(route.durationMin - fastest));
}
