import { useEffect, useRef, useState, type RefObject } from 'react';
import type { useCurrentLocation } from '../../../features/map/hooks/useCurrentLocation';
import type { LeafletMapController } from '../../../features/map/services/LeafletMapController';
import type { PickTarget } from '../../../features/routing/components/RoutePanel';
import type { DirectionsController } from '../../../features/routing/hooks/useDirections';
import { placeFromPoint } from '../../../features/places/services/placeFromPoint';
import type { Place } from '../../../features/places/types';
import { RequestSequence } from '../../../shared/async/RequestSequence';
import type { LatLng } from '../../../shared/geo/types';
import { errorMessage } from '../../../shared/text/errorMessage';

type Options = {
  directions: DirectionsController;
  locate: ReturnType<typeof useCurrentLocation>['locate'];
  mapController: RefObject<LeafletMapController | null>;
  showToast: (message: string) => void;
  t: (text: string) => string;
};

/**
 * Đặt điểm đi/đến từ một tọa độ (chạm bản đồ hoặc GPS) sau khi tra địa chỉ.
 * Tra địa chỉ có thể mất vài giây: kết quả chỉ được ghi nếu vẫn là yêu cầu mới nhất của điểm đó
 * VÀ trong lúc chờ người dùng chưa tự chọn điểm khác (gõ tìm, đảo chiều…).
 */
export function useEndpointPicker({ directions, locate, mapController, showToast, t }: Options) {
  const [isLocating, setIsLocating] = useState(false);
  const requests = useRef(new RequestSequence<PickTarget>());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  /** Điểm đi/đến hiện tại, đọc được sau `await` (closure chỉ giữ giá trị cũ). */
  const currentEndpoints = useRef({ origin: directions.origin, destination: directions.destination });
  currentEndpoints.current = { origin: directions.origin, destination: directions.destination };

  const beginLookup = (target: PickTarget) => {
    const requestId = requests.current.next(target);
    const before = currentEndpoints.current[target];
    return () =>
      mounted.current &&
      requests.current.isLatest(target, requestId) &&
      currentEndpoints.current[target] === before;
  };

  const setEndpoint = (target: PickTarget, place: Place) => {
    if (target === 'origin') directions.setOrigin(place);
    else directions.setDestination(place);
  };

  /** Người dùng chạm bản đồ để chọn điểm đi/đến. */
  const pickPoint = async (target: PickTarget, point: LatLng) => {
    const stillWanted = beginLookup(target);
    const place = await placeFromPoint(point, 'map');
    if (stillWanted()) setEndpoint(target, place);
  };

  /** Nút "Vị trí của tôi" trong panel chỉ đường: đặt GPS làm điểm xuất phát. */
  const useMyLocationAsOrigin = async () => {
    setIsLocating(true);
    try {
      const stillWanted = beginLookup('origin');
      const fix = await locate();
      const place = await placeFromPoint(fix.point, 'gps');
      if (!stillWanted()) return;
      directions.setOrigin(place);
      mapController.current?.flyTo(fix.point, 15);
    } catch (error) {
      showToast(t(errorMessage(error, 'Không lấy được vị trí.')));
    } finally {
      setIsLocating(false);
    }
  };

  return { isLocating, pickPoint, useMyLocationAsOrigin };
}
