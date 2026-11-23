import { useCallback, useEffect, useRef, useState } from 'react';
import type { RerouteStrategy } from '@routetwin/shared';
import { rerouteApi } from '../../../features/guidance/api/RerouteApiClient';
import { routePlanFromResult } from '../../../features/routing/api/RouteApiClient';
import {
  IncidentAheadDetector,
  type RouteIncident,
} from '../../../features/guidance/domain/IncidentAheadDetector';
import type { useNavigationSession } from '../../../features/guidance/hooks/useNavigationSession';
import type { RoutePlan } from '../../../features/routing/types';
import { basicPlaceFromPoint } from '../../../features/places/domain/pointPlace';
import { errorMessage } from '../../../shared/text/errorMessage';
import { RequestGeneration } from '../../../shared/async/RequestGeneration';

/** Lệch tuyến liên tiếp bao nhiêu lần đo GPS thì tự tính lại, và tối thiểu cách nhau bao lâu. */
const OFF_ROUTE_FIXES_BEFORE_REROUTE = 3;
const AUTO_REROUTE_INTERVAL_MS = 20_000;
/** Số sự cố tối đa gửi kèm yêu cầu tính lại để tránh. */
const MAX_AVOIDED_INCIDENTS = 30;

/** Thông báo cho người dùng biết tuyến mới được chọn thế nào (kết quả của /routes/reroute). */
const rerouteStrategyLabels: Record<RerouteStrategy, string> = {
  direct: 'Đã tính lại tuyến từ vị trí hiện tại',
  alternative: 'Đã chuyển sang tuyến thay thế để tránh sự cố',
  detour: 'Đã đi vòng để tránh sự cố',
  unavoidable: 'Không tìm được đường tránh sự cố, hãy chú ý',
};

type Options = {
  navigation: ReturnType<typeof useNavigationSession>;
  routeIncidents: RouteIncident[];
  /** Tuyến mới đã tính xong cho chuyến đang dẫn. */
  onRerouted: (plan: RoutePlan) => void;
  showToast: (message: string) => void;
  t: (text: string) => string;
};

/**
 * Tính lại tuyến từ vị trí GPS hiện tại tới các điểm còn lại, tránh các sự cố đang biết:
 * tự động khi lệch tuyến đủ lâu, hoặc khi người dùng bấm nút.
 */
export function useNavigationRerouting({ navigation, routeIncidents, onRerouted, showToast, t }: Options) {
  const { route, location, nextStopIndex, offRoute, offRouteFixes } = navigation;
  const [isRecalculating, setIsRecalculating] = useState(false);
  const lastAutomaticRerouteAt = useRef(0);
  const inFlight = useRef(false);
  const generation = useRef(new RequestGeneration());
  const routeId = route?.id;
  useEffect(() => {
    const requests = generation.current;
    inFlight.current = false;
    // Một lần tính lại tạo id tuyến mới, nhưng vẫn thuộc chuyến đi đang dẫn.
    if (!routeId) lastAutomaticRerouteAt.current = 0;
    setIsRecalculating(false);
    return () => {
      requests.invalidate();
      inFlight.current = false;
    };
  }, [routeId]);
  // Giữ id tuyến đang dẫn trong ref để bỏ kết quả tính lại nếu chuyến đi đã đổi trong lúc chờ API.
  const routeIdRef = useRef<string | null>(null);
  routeIdRef.current = route?.id ?? null;
  const onReroutedRef = useRef(onRerouted);
  onReroutedRef.current = onRerouted;

  /**
   * @param automatic do app tự gọi (chỉ báo khi tuyến thực sự đổi hướng)
   * @param reason lý do hiển thị cho người dùng (vd. "Ngập đường phía trước 500 m")
   */
  const recalculate = useCallback(
    async (automatic = false, reason?: string) => {
      if (!route || !location || inFlight.current) return;
      const remainingStops = route.stops.slice(nextStopIndex);
      const destinationStops = remainingStops.length ? remainingStops : route.stops.slice(-1);
      if (!destinationStops.length) return;

      const request = generation.current.begin();
      const isCurrent = () => request.isCurrent() && routeIdRef.current === route.id;
      inFlight.current = true;
      setIsRecalculating(true);
      let plan: RoutePlan;
      let strategy: RerouteStrategy;
      try {
        const result = await rerouteApi.reroute({
          from: location,
          stops: destinationStops.map(({ lat, lng }) => ({ lat, lng })),
          vehicle: route.vehicle,
          objective: route.objective === 'distance' ? 'distance' : 'duration',
          avoid: routeIncidents.slice(0, MAX_AVOIDED_INCIDENTS).map(({ lat, lng }) => ({
            lat,
            lng,
            radiusMeters: IncidentAheadDetector.INCIDENT_RADIUS_METERS,
          })),
          // Tuyến gốc tránh phà thì tuyến tính lại cũng phải tránh.
          ...(route.avoidFerry ? { avoidRoads: ['ferry' as const] } : {}),
        });
        plan = routePlanFromResult(
          result.route,
          [basicPlaceFromPoint(location, 'gps'), ...destinationStops],
          route.vehicle,
          route.objective,
          route.avoidFerry ?? false,
        );
        strategy = result.strategy;
      } catch (error) {
        if (isCurrent() && (!automatic || reason))
          showToast(t(errorMessage(error, 'Không tính lại được tuyến.')));
        return;
      } finally {
        if (request.isCurrent()) {
          inFlight.current = false;
          setIsRecalculating(false);
        }
      }
      if (!isCurrent()) return;
      onReroutedRef.current(plan);
      if (reason || !automatic || strategy !== 'direct') {
        showToast(`${reason ? `${reason} · ` : ''}${t(rerouteStrategyLabels[strategy])}`);
      }
    },
    [route, location, nextStopIndex, routeIncidents, showToast, t],
  );

  // Lệch tuyến đủ lâu thì tự tính lại, nhưng không dồn dập hơn AUTO_REROUTE_INTERVAL_MS.
  useEffect(() => {
    if (!location || !offRoute || offRouteFixes < OFF_ROUTE_FIXES_BEFORE_REROUTE || isRecalculating) return;
    const now = Date.now();
    if (now - lastAutomaticRerouteAt.current < AUTO_REROUTE_INTERVAL_MS) return;
    lastAutomaticRerouteAt.current = now;
    void recalculate(true);
  }, [location, offRoute, offRouteFixes, isRecalculating, recalculate]);

  return { isRecalculating, recalculate };
}
