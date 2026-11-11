import type { SavedRoute } from '../types';

/** Nơi lưu các tuyến đã lưu. Hiện lưu trên thiết bị; sau này có thể thay bằng bản gọi API mà hook không đổi. */
export interface SavedRouteRepository {
  load(): SavedRoute[];
  save(routes: SavedRoute[]): void;
}

/** Lưu trong localStorage của trình duyệt. Khóa "v2" vì kiểu Place đã đổi (district -> address). */
export class LocalStorageSavedRouteRepository implements SavedRouteRepository {
  constructor(private readonly key = 'routetwin-saved-routes-v2') {}

  load(): SavedRoute[] {
    try {
      const value = localStorage.getItem(this.key);
      const routes: unknown = value ? JSON.parse(value) : [];
      return Array.isArray(routes)
        ? (routes as SavedRoute[]).filter((route) => Boolean(route?.origin?.name && route?.kind))
        : [];
    } catch {
      return [];
    }
  }

  save(routes: SavedRoute[]): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(routes));
    } catch {
      /* Trình duyệt có thể chặn storage (chế độ riêng tư, hết dung lượng). */
    }
  }
}
