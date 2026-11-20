import { useEffect, useRef } from 'react';
import type { RoutePlan } from '../../routing/types';
import type { LatLng } from '../../../shared/geo/types';
import { deleteRouteWatch, upsertRouteWatch } from '../api/webPush';

/** Làm mới tuyến + vị trí trên server mỗi bao lâu khi đang dẫn đường (server hết hạn sau 20 phút). */
const NAVIGATING_REFRESH_MS = 60_000;
const PREVIEW_REFRESH_MS = 10 * 60_000;

/**
 * Đồng bộ tuyến đang đi / đang xem lên server (route_watches) để API biết gửi Web Push cho ai
 * khi có người báo cáo sự cố trên tuyến. Bỏ tuyến thì xóa khỏi server.
 */
export function useRouteWatch(
  endpoint: string | null,
  route: RoutePlan | null,
  isNavigating: boolean,
  location: LatLng | null,
) {
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    if (!endpoint || !route) return;
    const path = route.legs.flatMap((leg, index) => (index === 0 ? leg.points : leg.points.slice(1)));
    if (path.length < 2) return;
    let active = true;
    const sync = () => {
      if (!active) return;
      void upsertRouteWatch(endpoint, route.vehicle, path, isNavigating ? locationRef.current : null).catch(
        () => undefined,
      );
    };
    sync();
    const timer = window.setInterval(sync, isNavigating ? NAVIGATING_REFRESH_MS : PREVIEW_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [endpoint, route, isNavigating]);

  // Không còn tuyến (đóng tuyến, dừng dẫn đường) thì thôi nhận push cho tuyến cũ.
  const hadRoute = useRef(false);
  useEffect(() => {
    if (route) {
      hadRoute.current = true;
      return;
    }
    if (endpoint && hadRoute.current) {
      hadRoute.current = false;
      void deleteRouteWatch(endpoint).catch(() => undefined);
    }
  }, [endpoint, route]);
}
