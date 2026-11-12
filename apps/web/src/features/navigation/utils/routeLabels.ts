import type { RouteVariant } from '@routetwin/shared';

type RouteLike = { durationMin: number; distanceKm: number; variant?: RouteVariant };

const variantLabels: Record<Exclude<RouteVariant, 'default'>, string> = {
  alternative: 'Tuyến khác',
  'avoid-toll': 'Tránh trạm thu phí',
  'avoid-ferry': 'Tránh phà',
};

/** Nhãn của một phương án: Nhanh nhất / Ngắn nhất / lý do tồn tại (tránh trạm thu phí, phà; hoặc "Tuyến khác"). */
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
  // "Tuyến khác" chỉ là nhãn dự phòng: bỏ khi phương án đã có nhãn Nhanh nhất/Ngắn nhất.
  if (route.variant && route.variant !== 'default' && !(route.variant === 'alternative' && labels.length)) {
    labels.push(variantLabels[route.variant]);
  }
  return labels;
}

/** Số phút chậm hơn phương án nhanh nhất (làm tròn); 0 nếu là phương án nhanh nhất. */
export function minutesSlowerThanFastest(route: RouteLike, routes: RouteLike[]): number {
  const fastest = Math.min(...routes.map((item) => item.durationMin));
  return Math.max(0, Math.round(route.durationMin - fastest));
}
