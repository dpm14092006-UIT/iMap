import { useCallback, useEffect, useState } from 'react';
import type { RoutePlan } from '../../map/types';
import type { SavedRoute } from '../types';

/** Khóa localStorage. Tăng "v2" vì kiểu Place đã đổi (district -> address). */
const STORAGE_KEY = 'routetwin-saved-routes-v2';

function readSavedRoutes(): SavedRoute[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const routes = value ? (JSON.parse(value) as SavedRoute[]) : [];
    return Array.isArray(routes) ? routes.filter((route) => Boolean(route?.origin?.name && route?.kind)) : [];
  } catch {
    return [];
  }
}

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

/** Tuyến đã lưu trên thiết bị (localStorage). Sẽ chuyển sang API khi có module my-routes ở backend. */
export function useSavedRoutes() {
  const [routes, setRoutes] = useState<SavedRoute[]>(readSavedRoutes);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
    } catch {
      /* Trình duyệt có thể chặn storage (chế độ riêng tư, hết dung lượng). */
    }
  }, [routes]);

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
