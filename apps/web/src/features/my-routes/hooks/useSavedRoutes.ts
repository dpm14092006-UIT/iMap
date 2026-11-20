import { useCallback, useState } from 'react';
import type { RoutePlan } from '../../map/types';
import {
  LocalStorageSavedRouteRepository,
  type SavedRouteRepository,
} from '../services/SavedRouteRepository';
import { savedRouteKey } from '../services/savedRouteKey';
import type { SavedRoute } from '../types';

const defaultRepository = new LocalStorageSavedRouteRepository();

function toSavedRoute(plan: RoutePlan): SavedRoute {
  const first = plan.stops[0]!;
  const last = plan.stops[plan.stops.length - 1]!;
  const title =
    plan.kind === 'multi'
      ? `Hành trình ${Math.max(0, plan.stops.length - 1)} điểm · ${first.name}`
      : `${first.name} → ${last.name}`;
  return {
    id: `${plan.id}-${Date.now()}`,
    kind: plan.kind,
    title,
    origin: first,
    destination: last,
    stops: plan.stops,
    vehicle: plan.vehicle,
    // Không lưu cả `plan` (hình học tuyến rất nặng): khi mở lại luôn tính lại bằng VietMap.
    objective: plan.objective,
    originId: first.id,
    originName: first.name,
    destinationId: last.id,
    destinationName: last.name,
  };
}

/** Danh sách tuyến đã lưu; nơi lưu thật nằm sau `SavedRouteRepository`. */
export function useSavedRoutes(repository: SavedRouteRepository = defaultRepository) {
  const [routes, setRoutes] = useState<SavedRoute[]>(() => repository.load());

  /** Ghi danh sách mới xuống nơi lưu rồi cập nhật giao diện; trả về false nếu không ghi được. */
  const commit = useCallback(
    (next: SavedRoute[]) => {
      const persisted = repository.save(next);
      setRoutes(next);
      return persisted;
    },
    [repository],
  );

  /** Lưu tuyến lên đầu danh sách; nếu đã lưu đúng tuyến này (xem `savedRouteKey`) thì thay bằng bản mới. */
  const save = useCallback(
    (plan: RoutePlan): boolean => {
      const item = toSavedRoute(plan);
      const key = savedRouteKey(item);
      return commit([item, ...routes.filter((route) => savedRouteKey(route) !== key)]);
    },
    [commit, routes],
  );

  const remove = useCallback(
    (id: string): boolean => commit(routes.filter((route) => route.id !== id)),
    [commit, routes],
  );

  return { routes, save, remove };
}
