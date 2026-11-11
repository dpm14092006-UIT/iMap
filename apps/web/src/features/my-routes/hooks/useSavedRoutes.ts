import { useCallback, useEffect, useState } from 'react';
import type { RoutePlan } from '../../map/types';
import {
  LocalStorageSavedRouteRepository,
  type SavedRouteRepository,
} from '../services/SavedRouteRepository';
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
    plan,
    originId: first.id,
    originName: first.name,
    destinationId: last.id,
    destinationName: last.name,
  };
}

/** Danh sách tuyến đã lưu; nơi lưu thật nằm sau `SavedRouteRepository`. */
export function useSavedRoutes(repository: SavedRouteRepository = defaultRepository) {
  const [routes, setRoutes] = useState<SavedRoute[]>(() => repository.load());

  useEffect(() => {
    repository.save(routes);
  }, [repository, routes]);

  /** Lưu tuyến lên đầu danh sách; tuyến trùng tiêu đề được thay bằng bản mới. */
  const save = useCallback((plan: RoutePlan) => {
    const item = toSavedRoute(plan);
    setRoutes((current) => [item, ...current.filter((route) => route.title !== item.title)]);
  }, []);

  const remove = useCallback((id: string) => {
    setRoutes((current) => current.filter((route) => route.id !== id));
  }, []);

  return { routes, save, remove };
}
