import type { RoutePlan } from '../../routing/types';
import type { SavedRoute } from '../types';

/** Tùy chọn của panel chỉ đường không nằm trong RoutePlan nhưng cần để mở lại đúng tuyến. */
export type SaveRouteOptions = {
  avoidFerry?: boolean;
  /**
   * Lưu từ panel nào. Tuyến chỉ đường có điểm ghé mang kind 'multi' (routePlanFromResult đặt theo số điểm),
   * nên phải ghi rõ 'directions' để khi mở lại quay về panel Chỉ đường, giữ điểm ghé và "tránh phà".
   */
  panel?: 'directions' | 'multi';
};

export function toSavedRoute(plan: RoutePlan, options: SaveRouteOptions = {}): SavedRoute {
  const first = plan.stops[0]!;
  const last = plan.stops[plan.stops.length - 1]!;
  const kind = options.panel === 'directions' ? 'route' : plan.kind;
  const title =
    kind === 'multi'
      ? `Hành trình ${Math.max(0, plan.stops.length - 1)} điểm · ${first.name}`
      : `${first.name} → ${last.name}`;
  return {
    id: `${plan.id}-${Date.now()}`,
    kind,
    title,
    origin: first,
    destination: last,
    stops: plan.stops,
    vehicle: plan.vehicle,
    // Không lưu cả `plan` (hình học tuyến rất nặng): khi mở lại luôn tính lại bằng VietMap.
    objective: plan.objective,
    avoidFerry: options.avoidFerry ?? false,
    originId: first.id,
    originName: first.name,
    destinationId: last.id,
    destinationName: last.name,
  };
}
