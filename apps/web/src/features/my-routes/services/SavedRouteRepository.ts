import type { SavedRoute } from '../types';

/** Nơi lưu các tuyến đã lưu. Hiện lưu trên thiết bị; sau này có thể thay bằng bản gọi API mà hook không đổi. */
export interface SavedRouteRepository {
  load(): SavedRoute[];
  /** Trả về false nếu không lưu được (storage bị chặn hoặc đầy) để giao diện báo đúng cho người dùng. */
  save(routes: SavedRoute[]): boolean;
}

/** Dữ liệu cũ có kèm cả tuyến (nặng): chỉ giữ lại tiêu chí, lần lưu sau sẽ ghi bản gọn. */
function withoutLegacyPlan(route: SavedRoute): SavedRoute {
  if (!route.plan) return route;
  const { plan, ...rest } = route;
  return { ...rest, objective: route.objective ?? plan.objective };
}

/** Lưu trong localStorage của trình duyệt. Khóa "v2" vì kiểu Place đã đổi (district -> address). */
export class LocalStorageSavedRouteRepository implements SavedRouteRepository {
  constructor(private readonly key = 'routetwin-saved-routes-v2') {}

  load(): SavedRoute[] {
    try {
      const value = localStorage.getItem(this.key);
      const routes: unknown = value ? JSON.parse(value) : [];
      return Array.isArray(routes)
        ? (routes as SavedRoute[])
            .filter((route) => Boolean(route?.origin?.name && route?.kind))
            .map(withoutLegacyPlan)
        : [];
    } catch {
      return [];
    }
  }

  save(routes: SavedRoute[]): boolean {
    try {
      localStorage.setItem(this.key, JSON.stringify(routes));
      return true;
    } catch {
      // Trình duyệt có thể chặn storage (chế độ riêng tư) hoặc hết dung lượng (QuotaExceededError).
      return false;
    }
  }
}
