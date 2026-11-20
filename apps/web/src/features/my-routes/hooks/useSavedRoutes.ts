import { useCallback, useState } from 'react';
import type { RoutePlan } from '../../map/types';
import {
  LocalStorageSavedRouteRepository,
  type SavedRouteRepository,
} from '../services/SavedRouteRepository';
import { savedRouteKey } from '../services/savedRouteKey';
import { toSavedRoute, type SaveRouteOptions } from '../services/toSavedRoute';
import type { SavedRoute } from '../types';

export type { SaveRouteOptions } from '../services/toSavedRoute';

const defaultRepository = new LocalStorageSavedRouteRepository();

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
    (plan: RoutePlan, options?: SaveRouteOptions): boolean => {
      const item = toSavedRoute(plan, options);
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
