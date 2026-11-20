import { useEffect, useRef } from 'react';
import type { RoutePlan } from '../../../features/routing/types';
import { useRecentPlaces } from '../../../features/places/context/RecentPlacesProvider';
import { recentPlaceKey } from '../../../features/places/domain/recentPlaces';

/**
 * Ghi điểm đi / điểm đến của tuyến đang xem vào lịch sử 10 điểm gần nhất (tài khoản đã đăng nhập).
 * Chỉ ghi khi điểm đi/đến thật sự đổi; chọn phương án khác hay tính lại cùng tuyến thì không ghi lại.
 */
export function useRecentRouteEndpoints(route: RoutePlan | null) {
  const { enabled, record } = useRecentPlaces();
  const recordedEndpoints = useRef<{ key: string; record: typeof record } | null>(null);

  useEffect(() => {
    // Chưa đăng nhập (hoặc vừa đăng xuất) thì chưa ghi và quên tuyến đã ghi, để tài khoản đăng nhập sau
    // vẫn được ghi tuyến đang xem.
    if (!enabled) {
      recordedEndpoints.current = null;
      return;
    }
    if (!route || route.stops.length < 2) return;
    const origin = route.stops[0]!;
    const destination = route.stops[route.stops.length - 1]!;
    const endpoints = `${recentPlaceKey(origin)}→${recentPlaceKey(destination)}`;
    if (endpoints === recordedEndpoints.current?.key && record === recordedEndpoints.current.record) return;
    recordedEndpoints.current = { key: endpoints, record };
    record('origin', origin);
    record('destination', destination);
  }, [route, record, enabled]);
}
