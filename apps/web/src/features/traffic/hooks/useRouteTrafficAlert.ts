import type { RerouteStrategy } from '@routetwin/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoutePlan } from '../../map/types';
import { rerouteApi } from '../../navigation/api/RerouteApiClient';
import { routePlanFromResult } from '../../navigation/api/RouteApiClient';
import { basicPlaceFromPoint } from '../../places/services/placeFromPoint';
import { routeHazardSection } from '../services/routeTraffic';
import type { LatLng } from '../../places/types';
import { playAlertFeedback, showLocalSystemNotification } from '../../notifications/services/alertFeedback';

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

function roughDistanceMeters(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const north = (b.lat - a.lat) * 111_320;
  return Math.hypot(east, north);
}

/** Hỏi đổi tuyến trong bao lâu; hết giờ thì giữ tuyến hiện tại. */
export const REROUTE_DECISION_MS = 15_000;
const CLOSE_AFTER_DECISION_MS = 4_000;
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
  onAccept: (plan: RoutePlan) => void;
  notificationText: (incident: RouteAlertIncident) => { title: string; body: string };
};

/**
 * Cảnh báo sự cố trên tuyến: kêu + rung + banner lớn (và thông báo hệ thống khi tab chạy nền),
 * rồi tự tìm đường tránh và hỏi người dùng Có/Không. 15 giây không trả lời thì giữ tuyến cũ.
 */
export function useRouteTrafficAlert(options: Options) {
  const [alert, setAlert] = useState<RouteTrafficAlertState | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  /** Mỗi sự cố (hoặc cụm báo cáo trong 80 m) chỉ hỏi đổi tuyến một lần trong một chuyến. */
  const offered = useRef(new Map<string, LatLng>());
  const isOffered = (incident: RouteAlertIncident) =>
    offered.current.has(incident.id) ||
    [...offered.current.values()].some(
      (point) => roughDistanceMeters(point, incident) <= AVOID_RADIUS_METERS,
    );
  const requestId = useRef(0);

  const close = useCallback(() => {
    requestId.current++;
    setAlert(null);
  }, []);

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
      });
      if (requestId.current !== id) return;
      if (result.strategy === 'unavoidable' || result.blockedCount > 0) {
        setAlert((current) => (current ? { ...current, offer: { status: 'none' } } : current));
        return;
      }
      const startPlace = isNavigating && location ? basicPlaceFromPoint(location, 'gps') : route.stops[0]!;
      const plan = routePlanFromResult(result.route, [startPlace, ...stops], route.vehicle, route.objective);
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
      if (requestId.current !== id) return;
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
      playAlertFeedback();
      if (document.visibilityState !== 'visible' && !pushActive) {
        const text = notificationText(incident);
        void showLocalSystemNotification(text.title, text.body, `traffic-${incident.id}`);
      }
      const onRoute =
        (routeHazardSection(route, incident)?.distanceMeters ?? Infinity) <= AVOID_RADIUS_METERS;
      const alreadyOffered = isOffered(incident);
      offered.current.set(incident.id, { lat: incident.lat, lng: incident.lng });
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

  const alertRef = useRef(alert);
  alertRef.current = alert;
  const accept = useCallback(() => {
    const current = alertRef.current;
    if (!current || current.offer.status !== 'ready' || current.decision !== 'pending') return;
    optionsRef.current.onAccept(current.offer.plan);
    setAlert({ ...current, decision: 'accepted' });
  }, []);

  const keep = useCallback(() => {
    setAlert((current) =>
      current && current.decision === 'pending' ? { ...current, decision: 'kept' } : current,
    );
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
    const timer = window.setTimeout(close, CLOSE_AFTER_DECISION_MS * 2);
    return () => window.clearTimeout(timer);
  }, [settled, close]);

  // Không còn tuyến (dừng dẫn đường / đóng tuyến) thì bỏ cảnh báo và quên các sự cố đã hỏi.
  const hasRoute = Boolean(options.route);
  useEffect(() => {
    if (hasRoute) return;
    offered.current.clear();
    close();
  }, [hasRoute, close]);

  return { alert, trigger, accept, keep, close, wasOffered: isOffered };
}
