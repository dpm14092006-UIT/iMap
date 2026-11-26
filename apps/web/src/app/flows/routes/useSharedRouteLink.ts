import { useEffect, useMemo, useRef } from 'react';
import type { DirectionsController } from '../../../features/routing/hooks/useDirections';
import type { Place } from '../../../features/places/types';
import { parsePlaceShareLink, parseRouteShareLink } from '../../../features/routing/domain/routeShareLink';

/** Liên kết chia sẻ ?from=…&to=…&mode=…(&via=…&by=…&ferry=…) tự điền tuyến và tính một lần khi tải trang. */
export function useSharedRouteLink(directions: DirectionsController) {
  const sharedRoute = useMemo(() => parseRouteShareLink(window.location.search), []);
  const applied = useRef(false);
  useEffect(() => {
    if (!sharedRoute || applied.current) return;
    applied.current = true;
    void directions.open(sharedRoute);
  }, [sharedRoute, directions]);
}

/** Liên kết ?place=lat,lng,tên mở thẳng chi tiết địa điểm một lần khi tải trang. */
export function useSharedPlaceLink(openPlace: (place: Place) => void) {
  const sharedPlace = useMemo(() => parsePlaceShareLink(window.location.search), []);
  const applied = useRef(false);
  useEffect(() => {
    if (!sharedPlace || applied.current) return;
    applied.current = true;
    openPlace(sharedPlace);
  }, [sharedPlace, openPlace]);
}
