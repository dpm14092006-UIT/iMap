import { useEffect, useRef, useState } from 'react';
import type { TrafficReportDto } from '@routetwin/shared';
import {
  IncidentAheadDetector,
  type RouteIncident,
} from '../../../features/guidance/domain/IncidentAheadDetector';
import type { RoutePath } from '../../../features/guidance/domain/RoutePath';
import type { useNavigationSession } from '../../../features/guidance/hooks/useNavigationSession';
import type { RoutePlan } from '../../../features/routing/types';
import { usePushNotifications } from '../../../features/notifications/hooks/usePushNotifications';
import { useRouteWatch } from '../../../features/notifications/hooks/useRouteWatch';
import { useRouteTrafficAlert } from '../../../features/traffic/hooks/useRouteTrafficAlert';
import { pickCommunityCounts } from '../../../features/traffic/domain/realtimeReport';
import { alertCommunityInfo } from '../../../features/traffic/domain/trafficOverview';
import { ROUTE_ALERT_CORRIDOR_METERS } from '../../../features/traffic/domain/routeTraffic';
import type { TrafficMapLayer } from '../../../features/traffic/domain/trafficMapLayer';
import { incidentLabels } from '../../../features/traffic/domain/trafficPresentation';
import type { IncidentKind } from '../../../features/traffic/types';
import type { RouteReportHandler } from './useRealtimeRouteReports';

const PUSH_CARD_DISMISSED_KEY = 'imap.pushCardDismissed';
/** Khớp báo cáo vào tuyến từ hơi phía sau vị trí hiện tại (mét), để sai số GPS không bỏ sót. */
const MATCH_BEHIND_METERS = 30;

function readPushCardDismissed(): boolean {
  try {
    return localStorage.getItem(PUSH_CARD_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

type Options = {
  navigation: ReturnType<typeof useNavigationSession>;
  navigationPath: RoutePath | null;
  /** Tuyến đang hiển thị khi chưa dẫn đường. */
  activeRoute: RoutePlan | null;
  reports: TrafficReportDto[];
  trafficLayer: TrafficMapLayer;
  routeIncidents: RouteIncident[];
  isRecalculating: boolean;
  isAuthenticated: boolean;
  /** Người dùng đồng ý đổi sang tuyến tránh sự cố. */
  onAcceptPlan: (plan: RoutePlan) => void;
  soundEnabled: () => boolean;
  /** Đăng ký nơi nhận báo cáo realtime/Web Push (xem useRealtimeRouteReports). */
  setReportHandler: (handler: RouteReportHandler) => void;
  t: (text: string, values?: Record<string, string | number>) => string;
};

/**
 * Cảnh báo sự cố trên tuyến: kêu/rung + banner lớn + hỏi Có/Không đổi sang đường khác.
 * Nguồn sự cố: báo cáo realtime/Web Push và sự cố đã biết nằm phía trước khi đang dẫn đường.
 * Kèm đăng ký Web Push theo tuyến và thẻ mời bật thông báo.
 */
export function useRouteAlerts(options: Options) {
  const { navigation, navigationPath, activeRoute, t } = options;
  const { status, route: navigationRoute, location, nextStopIndex, progressRatio } = navigation;
  const isNavigationIdle = status === 'idle';
  const isNavigating = status === 'navigating' || status === 'locating';
  const alertRoute = navigationRoute ?? activeRoute;

  const push = usePushNotifications(options.isAuthenticated);
  useRouteWatch(push.endpoint, alertRoute, Boolean(navigationRoute) && !isNavigationIdle, location);

  const routeAlert = useRouteTrafficAlert({
    route: alertRoute,
    isNavigating: Boolean(navigationRoute) && isNavigating,
    location,
    nextStopIndex,
    remainingMinutes: navigationRoute
      ? navigationRoute.durationMin * Math.max(0, 1 - progressRatio)
      : (activeRoute?.durationMin ?? null),
    otherIncidents: options.routeIncidents,
    pushActive: Boolean(push.endpoint),
    soundEnabled: options.soundEnabled,
    onAccept: options.onAcceptPlan,
    notificationText: (incident) => ({
      title: t('{incident} trên tuyến của bạn', { incident: t(incident.title) }),
      body: t('Mở để xem đường khác tránh sự cố.'),
    }),
  });
  const triggerRouteAlert = routeAlert.trigger;

  // Mỗi sự cố chỉ xử lý một lần trong một chuyến; kết thúc chuyến thì quên.
  const detector = useRef(new IncidentAheadDetector());
  useEffect(() => {
    if (isNavigationIdle) detector.current.reset();
  }, [isNavigationIdle]);

  // Báo cáo realtime: đang dẫn đường thì chỉ báo sự cố còn ở phía trước, kèm khoảng cách dọc tuyến.
  options.setReportHandler((report) => {
    let distanceAheadMeters: number | null = null;
    if (navigationPath && navigationRoute && !isNavigationIdle) {
      const progressMeters = progressRatio * navigationPath.totalMeters;
      const match = navigationPath.closest(report, progressMeters - MATCH_BEHIND_METERS);
      if (!match || match.distance > ROUTE_ALERT_CORRIDOR_METERS) return;
      distanceAheadMeters = Math.max(0, match.progress - progressMeters);
      detector.current.markHandled(report.id);
    }
    triggerRouteAlert(
      {
        id: report.id,
        lat: report.lat,
        lng: report.lng,
        severity: report.severity,
        title: incidentLabels[report.incidentType as IncidentKind] ?? 'Sự cố giao thông',
        // Web Push gửi kèm số liệu cộng đồng; Realtime thì lấy từ danh sách báo cáo khi tải lại.
        ...pickCommunityCounts(report),
      },
      distanceAheadMeters,
    );
  });

  // Sự cố đã biết nằm phía trước (trong 1,5 km) khi dẫn đường: cũng hỏi đổi tuyến thay vì tự đổi.
  const { routeIncidents, trafficLayer, isRecalculating } = options;
  useEffect(() => {
    if (status !== 'navigating' || !navigationPath || isRecalculating) return;
    const progressMeters = progressRatio * navigationPath.totalMeters;
    const ahead = detector.current.findAhead(navigationPath, progressMeters, routeIncidents);
    if (!ahead) return;
    detector.current.markHandled(ahead.incident.id);
    const severity =
      trafficLayer.features.find((feature) => feature.properties.id === ahead.incident.id)?.properties
        .severity ?? 'high';
    triggerRouteAlert(
      {
        id: ahead.incident.id,
        lat: ahead.incident.lat,
        lng: ahead.incident.lng,
        title: ahead.incident.title,
        severity,
      },
      ahead.distanceAheadMeters,
    );
  }, [
    status,
    navigationPath,
    progressRatio,
    routeIncidents,
    isRecalculating,
    trafficLayer,
    triggerRouteAlert,
  ]);

  // Thẻ mời bật Web Push: hiện khi có tuyến, trình duyệt hỗ trợ, server đã bật và người dùng chưa từ chối.
  const [pushCardDismissed, setPushCardDismissed] = useState(readPushCardDismissed);
  const dismissPushCard = () => {
    setPushCardDismissed(true);
    try {
      localStorage.setItem(PUSH_CARD_DISMISSED_KEY, '1');
    } catch {
      // Trình duyệt chặn lưu trữ: chỉ ẩn trong phiên này.
    }
  };
  const showPushCard =
    Boolean(alertRoute) &&
    !pushCardDismissed &&
    !routeAlert.alert &&
    push.supported &&
    push.serverEnabled &&
    push.permission !== 'denied' &&
    !push.endpoint;

  // Số liệu cộng đồng của sự cố đang cảnh báo: ưu tiên danh sách báo cáo mới nhất, rồi tới dữ liệu push.
  const alertCommunity = routeAlert.alert
    ? alertCommunityInfo(
        options.reports.find((report) => report.id === routeAlert.alert!.incident.id),
        routeAlert.alert.incident,
      )
    : null;

  return {
    push,
    routeAlert,
    alertCommunity,
    pushCard: {
      visible: showPushCard,
      dismiss: dismissPushCard,
      /** Đã bật xong thông báo: ẩn thẻ trong phiên này. */
      hide: () => setPushCardDismissed(true),
    },
  };
}
