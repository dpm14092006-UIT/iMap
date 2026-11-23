import type { RerouteStrategy } from '@routetwin/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '../../../shared/geo/types';
import { rerouteApi } from '../../guidance/api/RerouteApiClient';
import { playAlertFeedback, showLocalSystemNotification } from '../../notifications/services/alertFeedback';
import { basicPlaceFromPoint } from '../../places/domain/pointPlace';
import { routePlanFromResult } from '../../routing/api/RouteApiClient';
import type { RoutePlan } from '../../routing/types';
import { RerouteOfferMemory } from '../domain/RerouteOfferMemory';
import { routeHazardSection } from '../domain/routeTraffic';

/** Sự cố trên tuyến cần cảnh báo (từ Realtime, Web Push hoặc phát hiện phía trước khi dẫn đường). */
export type RouteAlertIncident = LatLng & {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  communityReportCount?: number;
  communityReporterCount?: number;
  communityUpdatedAt?: string | null;
};

export type RerouteOffer =
  | { status: 'computing' }
  | { status: 'ready'; plan: RoutePlan; deltaMin: number; strategy: RerouteStrategy; deadline: number }
  | { status: 'none' }
  /** Sự cố nằm cạnh chứ không nằm trên tuyến hiện tại: không cần đổi tuyến. */
  | { status: 'clear' }
  | { status: 'error'; message: string };

export type RouteTrafficAlertState = {
  incident: RouteAlertIncident;
  /** Còn cách bao xa dọc tuyến (khi đang dẫn đường). */
  distanceAheadMeters: number | null;
  offer: RerouteOffer;
  decision: 'pending' | 'accepted' | 'kept';
};

/** Hỏi đổi tuyến trong bao lâu; hết giờ thì giữ tuyến hiện tại. */
export const REROUTE_DECISION_MS = 15_000;
/** Banner tự đóng sau bao lâu (ms) khi đã chọn xong, không có đường khác hoặc lỗi. */
const CLOSE_AFTER_SETTLED_MS = 8_000;
/** Bán kính tránh quanh sự cố vừa báo cáo (mét). */
const AVOID_RADIUS_METERS = 80;

type Options = {
  route: RoutePlan | null;
  isNavigating: boolean;
  location: LatLng | null;
  nextStopIndex: number;
  /** Thời gian còn lại của tuyến hiện tại (phút) để so sánh với tuyến mới. */
  remainingMinutes: number | null;
  /** Các sự cố khác cũng nên tránh khi tìm đường mới. */
  otherIncidents: LatLng[];
  /** Có Web Push từ server không (có thì không cần tự hiện thông báo hệ thống khi tab chạy nền). */
  pushActive: boolean;
  soundEnabled?: () => boolean;
  onAccept: (plan: RoutePlan) => void;
  notificationText: (incident: RouteAlertIncident) => { title: string; body: string };
};

/**
 * Cảnh báo sự cố trên tuyến: kêu + rung + banner lớn (và thông báo hệ thống khi tab chạy nền),
 * rồi tự tìm đường tránh và hỏi người dùng Có/Không. 15 giây không trả lời thì giữ tuyến cũ.
 */
export function useRouteTrafficAlert(options: Options) {
  const [alert, setAlert] = useState<RouteTrafficAlertState | null>(null);
  const alertRef = useRef(alert);
  alertRef.current = alert;
  const alertRouteId = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  /** Mỗi sự cố trên tuyến (hoặc cụm báo cáo trong 80 m) chỉ hỏi đổi tuyến một lần trong một chuyến. */
  const offered = useRef(new RerouteOfferMemory(AVOID_RADIUS_METERS));
  const requestId = useRef(0);

  const invalidateRequest = useCallback(() => {
    requestId.current++;
    alertRef.current = null;
  }, []);
  const close = useCallback(() => {
    invalidateRequest();
    setAlert(null);
  }, [invalidateRequest]);

  const computeOffer = useCallback(async (incident: RouteAlertIncident, id: number) => {
    const { route, isNavigating, location, nextStopIndex, remainingMinutes, otherIncidents } =
      optionsRef.current;
    if (!route) return;
    const from = isNavigating && location ? location : route.stops[0];
    const destinations =
      isNavigating && location ? route.stops.slice(Math.max(1, nextStopIndex)) : route.stops.slice(1);
    const stops = destinations.length ? destinations : route.stops.slice(-1);
    if (!from || !stops.length) return;
    try {
      const result = await rerouteApi.reroute({
        from: { lat: from.lat, lng: from.lng },
        stops: stops.map(({ lat, lng }) => ({ lat, lng })),
        vehicle: route.vehicle,
        objective: route.objective === 'distance' ? 'distance' : 'duration',
        avoid: [
          { lat: incident.lat, lng: incident.lng, radiusMeters: AVOID_RADIUS_METERS },
          ...otherIncidents.slice(0, 29).map(({ lat, lng }) => ({ lat, lng, radiusMeters: 60 })),
        ],
        // Đường tránh sự cố vẫn phải giữ tùy chọn tránh phà của tuyến đang đi.
        ...(route.avoidFerry ? { avoidRoads: ['ferry' as const] } : {}),
      });
      if (requestId.current !== id || optionsRef.current.route?.id !== route.id) return;
      if (result.strategy === 'unavoidable' || result.blockedCount > 0) {
        setAlert((current) => (current ? { ...current, offer: { status: 'none' } } : current));
        return;
      }
      const startPlace = isNavigating && location ? basicPlaceFromPoint(location, 'gps') : route.stops[0]!;
      const plan = routePlanFromResult(
        result.route,
        [startPlace, ...stops],
        route.vehicle,
        route.objective,
        route.avoidFerry ?? false,
      );
      const deltaMin = plan.durationMin - (remainingMinutes ?? route.durationMin);
      setAlert((current) =>
        current
          ? {
              ...current,
              offer: {
                status: 'ready',
                plan,
                deltaMin,
                strategy: result.strategy,
                deadline: Date.now() + REROUTE_DECISION_MS,
              },
            }
          : current,
      );
    } catch (error) {
      if (requestId.current !== id || optionsRef.current.route?.id !== route.id) return;
      setAlert((current) =>
        current
          ? {
              ...current,
              offer: {
                status: 'error',
                message: error instanceof Error ? error.message : 'Không tìm được đường khác.',
              },
            }
          : current,
      );
    }
  }, []);

  /** Báo một sự cố trên tuyến. `distanceAheadMeters` null khi chỉ đang xem tuyến. */
  const trigger = useCallback(
    (incident: RouteAlertIncident, distanceAheadMeters: number | null) => {
      const { route, pushActive, notificationText } = optionsRef.current;
      if (!route) return;
      alertRouteId.current = route.id;
      playAlertFeedback(optionsRef.current.soundEnabled?.() ?? true);
      if (document.visibilityState !== 'visible' && !pushActive) {
        const text = notificationText(incident);
        void showLocalSystemNotification(text.title, text.body, `traffic-${incident.id}`);
      }
      const onRoute =
        (routeHazardSection(route, incident)?.distanceMeters ?? Infinity) <= AVOID_RADIUS_METERS;
      const alreadyOffered = offered.current.has(incident);
      // Chỉ nhớ sự cố trên tuyến; sự cố cạnh tuyến không được chặn việc hỏi đổi tuyến cho sự cố gần nó.
      if (onRoute) offered.current.remember(incident);
      const id = ++requestId.current;
      const shouldOffer = onRoute && !alreadyOffered;
      setAlert({
        incident,
        distanceAheadMeters,
        offer: shouldOffer ? { status: 'computing' } : onRoute ? { status: 'none' } : { status: 'clear' },
        decision: alreadyOffered && onRoute ? 'kept' : 'pending',
      });
      if (shouldOffer) void computeOffer(incident, id);
    },
    [computeOffer],
  );

  const accept = useCallback(() => {
    const current = alertRef.current;
    if (!current || current.offer.status !== 'ready' || current.decision !== 'pending') return;
    if (alertRouteId.current !== optionsRef.current.route?.id || Date.now() >= current.offer.deadline) return;
    const accepted: RouteTrafficAlertState = { ...current, decision: 'accepted' };
    // Lock the decision before notifying the parent; React may batch multiple button actions.
    alertRef.current = accepted;
    setAlert(accepted);
    optionsRef.current.onAccept(current.offer.plan);
  }, []);

  const keep = useCallback(() => {
    const current = alertRef.current;
    if (!current || current.decision !== 'pending') return;
    const kept: RouteTrafficAlertState = { ...current, decision: 'kept' };
    alertRef.current = kept;
    setAlert(kept);
  }, []);

  // Hết 15 giây chưa chọn thì giữ tuyến hiện tại.
  const deadline =
    alert?.offer.status === 'ready' && alert.decision === 'pending' ? alert.offer.deadline : null;
  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setTimeout(keep, Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline, keep]);

  // Đã quyết định (hoặc không có đường khác) thì tự đóng banner sau vài giây.
  const settled =
    alert !== null &&
    (alert.decision !== 'pending' ||
      alert.offer.status === 'none' ||
      alert.offer.status === 'clear' ||
      alert.offer.status === 'error');
  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(close, CLOSE_AFTER_SETTLED_MS);
    return () => window.clearTimeout(timer);
  }, [settled, close]);

  // A route change starts a fresh scope, including a direct A -> B switch without a null render.
  const routeId = options.route?.id;
  useEffect(() => {
    offered.current.clear();
    close();
    return invalidateRequest;
  }, [routeId, close, invalidateRequest]);

  const wasOffered = useCallback((incident: RouteAlertIncident) => offered.current.has(incident), []);

  return { alert, trigger, accept, keep, close, wasOffered };
}
