import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { MapController } from '../../../features/map/services/MapController';
import type { NavigationStatus } from '../../../features/guidance/types';
import type { RoutePlan } from '../../../features/routing/types';
import type { LatLng } from '../../../shared/geo/types';

type Options = {
  status: NavigationStatus;
  route: RoutePlan | null;
  /** Vị trí đã hút về tuyến (mũi tên dẫn đường). */
  displayLocation: LatLng | null;
};

/**
 * Bản đồ bám theo vị trí GPS trong lúc dẫn đường. Người dùng tự kéo / zoom thì tạm ngừng bám để xem trước
 * hành trình; bấm "Về vị trí" để bám lại.
 */
export function useNavigationFollow(
  mapController: RefObject<MapController | null>,
  { status, route, displayLocation }: Options,
) {
  const isIdle = status === 'idle';
  const [followPaused, setFollowPaused] = useState(false);

  useEffect(() => {
    if (isIdle) {
      setFollowPaused(false);
      return;
    }
    return mapController.current?.onUserGesture(() => setFollowPaused(true));
  }, [isIdle, mapController]);

  useEffect(() => {
    if (!followPaused && displayLocation && (status === 'navigating' || status === 'arrived')) {
      mapController.current?.followLocation(displayLocation);
    }
  }, [displayLocation, status, followPaused, mapController]);

  const recenter = useCallback(() => {
    setFollowPaused(false);
    if (displayLocation) mapController.current?.followLocation(displayLocation);
  }, [displayLocation, mapController]);

  const previewRoute = useCallback(() => {
    if (!route) return;
    setFollowPaused(true);
    mapController.current?.fitRoute(route);
  }, [route, mapController]);

  return {
    followPaused,
    recenter,
    previewRoute,
    /** Nút bản đồ (zoom, toàn Việt Nam) lúc dẫn đường cũng là xem trước: thôi bám vị trí. */
    pauseIfNavigating: () => {
      if (!isIdle) setFollowPaused(true);
    },
  };
}
