import { useCallback, useRef, useState } from 'react';
import type { RoutePlan } from '../../routing/types';
import {
  LocalStorageSavedRouteRepository,
  type SavedRouteRepository,
} from '../services/SavedRouteRepository';
import { savedRouteKey } from '../domain/savedRouteKey';
import { toSavedRoute, type SaveRouteOptions } from '../domain/toSavedRoute';
import type { SavedRoute } from '../types';

export type { SaveRouteOptions } from '../domain/toSavedRoute';

const defaultRepository = new LocalStorageSavedRouteRepository();

/** Danh sách tuyến đã lưu; nơi lưu thật nằm sau `SavedRouteRepository`. */
export function useSavedRoutes(repository: SavedRouteRepository = defaultRepository) {
  const [routes, setRoutes] = useState<SavedRoute[]>(() => repository.load());
  // Multiple actions can run before React renders again; each one must see the preceding write.
  const routesRef = useRef(routes);

  /** Ghi danh sách mới xuống nơi lưu rồi cập nhật giao diện; trả về false nếu không ghi được. */
  const commit = useCallback(
    (next: SavedRoute[]) => {
      const persisted = repository.save(next);
      routesRef.current = next;
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
      return commit([item, ...routesRef.current.filter((route) => savedRouteKey(route) !== key)]);
    },
    [commit],
  );

  const remove = useCallback(
    (id: string): boolean => commit(routesRef.current.filter((route) => route.id !== id)),
    [commit],
  );

  return { routes, save, remove };
}
