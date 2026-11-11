import type { RouteStopCandidate, StopPlace, TrafficReportBounds } from '@routetwin/shared';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssistantAccessPanel } from '../features/auth/components/AssistantAccessPanel';
import { useAuth } from '../features/auth/context/AuthProvider';
import { MapToolbar } from '../features/map/components/MapToolbar';
import { MapView } from '../features/map/components/MapView';
import { useCurrentLocation } from '../features/map/hooks/useCurrentLocation';
import { useTimeBasedMapLayer } from '../features/map/hooks/useTimeBasedMapLayer';
import type { LeafletMapController } from '../features/map/services/LeafletMapController';
import type { DraftStops, FeatureKey, RouteObjective, RoutePlan, TransportMode } from '../features/map/types';
import type { AlgorithmChoice } from '../features/multi-stop/utils/algorithms';
import { useSavedRoutes } from '../features/my-routes/hooks/useSavedRoutes';
import type { SavedRoute } from '../features/my-routes/types';
import { NavigationBanner } from '../features/navigation/components/NavigationBanner';
import type { PickTarget } from '../features/navigation/components/RoutePanel';
import { useAlgorithmComparison } from '../features/navigation/hooks/useAlgorithmComparison';
import { useDirections } from '../features/navigation/hooks/useDirections';
import { useNavigationSession } from '../features/navigation/hooks/useNavigationSession';
import { RouteApiClient, routePlanFromResult } from '../features/navigation/services/RouteApiClient';
import { rerouteApi } from '../features/navigation/services/RerouteApiClient';
import {
  IncidentAheadDetector,
  type RouteIncident,
} from '../features/navigation/domain/IncidentAheadDetector';
import { RoutePath } from '../features/navigation/domain/RoutePath';
import { isDemoModeEnabled } from '../features/navigation/utils/demoMode';
import { toTrafficMapLayer } from '../features/map/layers/trafficMapLayer';
import type { RerouteStrategy } from '@routetwin/shared';
import { formatDistanceKm, formatDurationMinutes } from '../features/navigation/utils/format';
import { PlaceSearchBar } from '../features/places/components/PlaceSearchBar';
import { popularPlaces } from '../features/places/data/popularPlaces';
import { basicPlaceFromPoint, placeFromPoint } from '../features/places/services/placeFromPoint';
import type { LatLng, Place } from '../features/places/types';
import { vietnamBounds } from '../features/traffic/api/trafficApi';
import type { IncidentKind, IncidentSeverity } from '../features/traffic/components/TrafficReportPanel';
import { useTrafficReports } from '../features/traffic/hooks/useTrafficReports';
import { toIncidents, toReportsMapLayer } from '../features/traffic/services/trafficPresentation';
import { Icon } from '../shared/components/Icon';
import { FeatureNav } from './components/FeatureNav';
import { PanelFallback } from './components/PanelFallback';
import { useToast } from './hooks/useToast';
import { useAppUpdate } from './hooks/useAppUpdate';

// Các panel chỉ tải mã khi người dùng mở, để lần tải đầu chỉ gồm bản đồ và thanh công cụ.
const PlaceAssistantPanel = lazy(() =>
  import('../features/place-assistant/components/PlaceAssistantPanel').then((module) => ({
    default: module.PlaceAssistantPanel,
  })),
);
const AuthPanel = lazy(() =>
  import('../features/auth/components/AuthPanel').then((module) => ({ default: module.AuthPanel })),
);
const RoutePanel = lazy(() =>
  import('../features/navigation/components/RoutePanel').then((module) => ({ default: module.RoutePanel })),
);
const MultiStopPanel = lazy(() =>
  import('../features/multi-stop/components/MultiStopPanel').then((module) => ({
    default: module.MultiStopPanel,
  })),
);
const SavedRoutesPanel = lazy(() =>
  import('../features/my-routes/components/SavedRoutesPanel').then((module) => ({
    default: module.SavedRoutesPanel,
  })),
);
const PlacePanel = lazy(() =>
  import('../features/places/components/PlacePanel').then((module) => ({ default: module.PlacePanel })),
);
const TrafficReportPanel = lazy(() =>
  import('../features/traffic/components/TrafficReportPanel').then((module) => ({
    default: module.TrafficReportPanel,
  })),
);

/** Khoảng cách (độ) tối đa để coi một click là "chọn" địa điểm gợi ý gần đó (~200 m). */
const PLACE_CLICK_TOLERANCE = 0.002;
/** Tâm Việt Nam, dùng khi bản đồ chưa sẵn sàng để trả tâm thật. */
const VIETNAM_CENTER: LatLng = { lat: 16, lng: 108 };
/** Thông báo cho người dùng biết tuyến mới được chọn thế nào (kết quả của /routes/reroute). */
const rerouteStrategyLabels: Record<RerouteStrategy, string> = {
  direct: 'Đã tính lại tuyến từ vị trí hiện tại',
  alternative: 'Đã chuyển sang tuyến thay thế để tránh sự cố',
  detour: 'Đã đi vòng để tránh sự cố',
  unavoidable: 'Không tìm được đường tránh sự cố, hãy chú ý',
};

/** Lệch tuyến liên tiếp bao nhiêu lần đo GPS thì tự tính lại, và tối thiểu cách nhau bao lâu. */
const OFF_ROUTE_FIXES_BEFORE_REROUTE = 3;
const AUTO_REROUTE_INTERVAL_MS = 20_000;

/** Đổi địa điểm do trợ lý (N2) gợi ý sang kiểu Place dùng chung. */
function placeFromStop(place: StopPlace): Place {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    lat: place.lat,
    lng: place.lng,
    source: 'osm',
  };
}

/** Địa điểm gợi ý gần điểm click nhất, hoặc null nếu không có điểm nào đủ gần. */
function findPlaceNear(point: LatLng): Place | null {
  return (
    popularPlaces.find(
      (place) =>
        Math.abs(place.lat - point.lat) < PLACE_CLICK_TOLERANCE &&
        Math.abs(place.lng - point.lng) < PLACE_CLICK_TOLERANCE,
    ) ?? null
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Khung ứng dụng: ghép bản đồ với các panel chức năng.
 * Trạng thái dùng chung (tuyến đang vẽ, panel đang mở, vị trí GPS) nằm ở đây;
 * logic riêng của từng chức năng nằm trong hook/component của feature tương ứng.
 */
export function App() {
  const routeApi = useMemo(() => new RouteApiClient(), []);
  const mapController = useRef<LeafletMapController | null>(null);
  const getMapCenter = useCallback(() => mapController.current?.getCenter() ?? VIETNAM_CENTER, []);
  const { toast, showToast } = useToast();
  const { location: currentLocation, locate } = useCurrentLocation();
  const { user, accessToken, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user && !user.is_anonymous && accessToken);
  const { layer, setLayer } = useTimeBasedMapLayer(); // nền tối tự bật theo giờ trên mobile
  const savedRoutes = useSavedRoutes();
  const { updateAvailable, reloadForUpdate } = useAppUpdate();

  const [activePanel, setActivePanel] = useState<FeatureKey | null>('directions');
  const [hasOpenedMulti, setHasOpenedMulti] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedMapPoint, setSelectedMapPoint] = useState<LatLng | null>(null);
  const [activeRoute, setActiveRoute] = useState<RoutePlan | null>(null);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [trafficBounds, setTrafficBounds] = useState<TrafficReportBounds>(vietnamBounds);

  // --- Dẫn đường theo GPS ---
  const navigation = useNavigationSession();
  const {
    status: navigationStatus,
    route: navigationRoute,
    location: navigationLocation,
    headingDegrees: navigationHeadingDegrees,
    nextStopIndex,
    offRoute,
    offRouteFixes,
    start: startNavigationSession,
    stop: stopNavigation,
    updateRoute: updateNavigationRoute,
  } = navigation;
  const isNavigationIdle = navigationStatus === 'idle';
  const isNavigating = navigationStatus === 'navigating' || navigationStatus === 'locating';
  const isNavigationMarkerVisible = navigationStatus !== 'idle' && navigationStatus !== 'error';
  const mapLocation = isNavigationIdle ? currentLocation : navigationLocation;
  const [isRecalculatingNavigation, setIsRecalculatingNavigation] = useState(false);
  const lastAutomaticRerouteAt = useRef(0);
  // Giữ id tuyến đang dẫn trong ref để bỏ kết quả tính lại nếu chuyến đi đã đổi trong lúc chờ API.
  const navigationRouteIdRef = useRef<string | null>(null);
  navigationRouteIdRef.current = navigationRoute?.id ?? null;

  // Tuyến trên bản đồ bị thay bằng tuyến khác thì dừng chuyến đang dẫn.
  useEffect(() => {
    if (navigationRoute && !isNavigationIdle && activeRoute?.id !== navigationRoute.id) stopNavigation();
  }, [activeRoute?.id, navigationRoute, isNavigationIdle, stopNavigation]);

  // Bản đồ bám theo vị trí GPS trong lúc dẫn đường.
  useEffect(() => {
    if (navigationLocation && (navigationStatus === 'navigating' || navigationStatus === 'arrived')) {
      mapController.current?.followLocation(navigationLocation);
    }
  }, [navigationLocation, navigationStatus]);

  // --- Giao thông (N2): báo cáo lấy từ API; bản đồ nhận qua hợp đồng TrafficMapLayer. ---
  const {
    reports,
    error: trafficError,
    loading: trafficLoading,
    create: createTrafficReport,
    clearance: updateClearance,
  } = useTrafficReports(accessToken, user?.id ?? null, trafficBounds, activePanel === 'traffic');
  const incidents = useMemo(() => toIncidents(reports), [reports]);
  const reportsLayer = useMemo(() => toReportsMapLayer(reports), [reports]);
  // Chế độ Demo (?demo=1): sự cố giả chỉ nằm trên máy này, vẽ chung với sự cố thật để thấy tuyến mới né chỗ nào.
  const demoEnabled = useMemo(() => isDemoModeEnabled(), []);
  const [demoIncidents, setDemoIncidents] = useState<RouteIncident[]>([]);
  const trafficLayer = useMemo(
    () =>
      demoIncidents.length === 0
        ? reportsLayer
        : {
            ...reportsLayer,
            features: [
              ...reportsLayer.features,
              ...toTrafficMapLayer(
                demoIncidents.map((incident) => ({
                  id: incident.id,
                  incidentType: 'road_closure',
                  severity: 'high' as const,
                  title: incident.title,
                  lat: incident.lat,
                  lng: incident.lng,
                })),
              ).features,
            ],
          },
    [reportsLayer, demoIncidents],
  );
  // Sự cố cần tránh khi dẫn đường: đang hoạt động, mức độ từ "Vừa" trở lên (gồm cả sự cố giả của demo).
  const routeIncidents = useMemo<RouteIncident[]>(
    () =>
      trafficLayer.features
        .filter((feature) => feature.properties.status === 'active' && feature.properties.severity !== 'low')
        .map((feature) => ({
          id: feature.properties.id,
          title: feature.properties.title,
          lng: feature.geometry.coordinates[0]!,
          lat: feature.geometry.coordinates[1]!,
        })),
    [trafficLayer],
  );

  const directions = useDirections({
    routeApi,
    activeRoute,
    onRouteChange: setActiveRoute,
    initialOrigin: null,
    initialDestination: null,
  });

  // So sánh Dijkstra / A* cho cùng điểm đi, điểm đến và loại xe của panel chỉ đường.
  const comparison = useAlgorithmComparison({
    origin: directions.origin,
    destination: directions.destination,
    vehicle: directions.vehicle,
  });

  // Marker A/B cho điểm đã chọn nhưng chưa tính tuyến (chỉ khi panel chỉ đường đang mở).
  const draftStops = useMemo<DraftStops>(
    () =>
      activePanel === 'directions'
        ? { origin: directions.origin, destination: directions.destination }
        : { origin: null, destination: null },
    [activePanel, directions.origin, directions.destination],
  );

  // Rời panel nhiều điểm thì bỏ kết quả tối ưu còn đang chờ, tránh vẽ đè tuyến của panel khác.
  const multiPlanGeneration = useRef(0);
  useEffect(() => {
    if (activePanel && activePanel !== 'multi') multiPlanGeneration.current++;
  }, [activePanel]);

  // Nhấn Esc để thoát chế độ chọn điểm trên bản đồ.
  useEffect(() => {
    if (!pickTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickTarget]);

  const openPanel = (key: FeatureKey | null) => {
    setActivePanel(key);
    if (key === 'multi') setHasOpenedMulti(true);
    setPickTarget(null);
  };
  const closePanel = () => openPanel(null);

  const selectFeature = (key: FeatureKey) => {
    setSelectedPlace(null);
    openPanel(key);
    if (key === 'traffic') setSelectedMapPoint(null);
  };

  const openPlace = (place: Place) => {
    setSelectedPlace(place);
    openPanel('place');
    mapController.current?.flyTo(place);
  };

  /** "Tìm đường đến đây" từ panel chi tiết: điểm đến = địa điểm, điểm đi = GPS nếu đã định vị. */
  const openDirections = (place: Place) => {
    if (currentLocation) directions.setOrigin(basicPlaceFromPoint(currentLocation, 'gps'));
    directions.setDestination(place);
    setSelectedPlace(null);
    openPanel('directions');
  };

  /** Click bản đồ: tùy panel đang mở mà xử lý khác nhau. */
  const handleMapClick = async (point: LatLng) => {
    // 1. Đang chọn điểm đi/đến trên bản đồ.
    if (pickTarget) {
      const target = pickTarget;
      setPickTarget(null);
      const place = await placeFromPoint(point, 'map');
      if (target === 'origin') directions.setOrigin(place);
      else directions.setDestination(place);
      return;
    }
    // 2. Panel giao thông / trợ lý địa điểm: chọn vị trí.
    if (activePanel === 'traffic' || activePanel === 'assistant') {
      setSelectedMapPoint(point);
      return;
    }
    // 3. Mặc định: click gần địa điểm gợi ý thì mở chi tiết địa điểm đó.
    const nearby = findPlaceNear(point);
    if (nearby && !activeRoute) openPlace(nearby);
  };

  /** Nút định vị trên thanh công cụ bản đồ. */
  const locateOnMap = async () => {
    try {
      const fix = await locate();
      mapController.current?.flyTo(fix.point, 16);
      showToast(`Đã định vị · sai số khoảng ${fix.accuracyMeters} m`);
    } catch (error) {
      showToast(errorMessage(error, 'Không lấy được vị trí.'));
    }
  };

  /** Nút "Vị trí của tôi" trong panel chỉ đường: đặt GPS làm điểm xuất phát. */
  const setOriginFromGps = async () => {
    setIsLocating(true);
    try {
      const fix = await locate();
      directions.setOrigin(await placeFromPoint(fix.point, 'gps'));
      mapController.current?.flyTo(fix.point, 15);
    } catch (error) {
      showToast(errorMessage(error, 'Không lấy được vị trí.'));
    } finally {
      setIsLocating(false);
    }
  };

  const startNavigation = (route: RoutePlan) => {
    // Mở app với ?demo=1 thì mặc định chạy GPS giả; đổi lại "Thật" ngay trên banner.
    startNavigationSession(route, demoEnabled ? 'demo' : 'real');
    openPanel(null);
  };

  /** Tính lại tuyến từ vị trí GPS hiện tại tới các điểm còn lại (tự động khi lệch tuyến, hoặc bấm nút). */
  const recalculateNavigation = useCallback(
    /** @param reason lý do hiển thị cho người dùng (vd. "Ngập đường phía trước 500 m") */
    async (automatic = false, reason?: string) => {
      if (!navigationRoute || !navigationLocation || isRecalculatingNavigation) return;
      const route = navigationRoute;
      const remainingStops = route.stops.slice(nextStopIndex);
      const destinationStops = remainingStops.length ? remainingStops : route.stops.slice(-1);
      if (!destinationStops.length) return;

      setIsRecalculatingNavigation(true);
      let plan: RoutePlan;
      let strategy: RerouteStrategy;
      try {
        // /routes/reroute: tính từ vị trí hiện tại và cố gắng tránh mọi sự cố đang biết.
        const result = await rerouteApi.reroute({
          from: navigationLocation,
          stops: destinationStops.map(({ lat, lng }) => ({ lat, lng })),
          vehicle: route.vehicle,
          objective: route.objective === 'distance' ? 'distance' : 'duration',
          avoid: routeIncidents.slice(0, 30).map(({ lat, lng }) => ({
            lat,
            lng,
            radiusMeters: IncidentAheadDetector.INCIDENT_RADIUS_METERS,
          })),
        });
        plan = routePlanFromResult(
          result.route,
          [basicPlaceFromPoint(navigationLocation, 'gps'), ...destinationStops],
          route.vehicle,
          route.objective,
        );
        strategy = result.strategy;
      } catch (error) {
        if (!automatic || reason) showToast(errorMessage(error, 'Không tính lại được tuyến.'));
        return;
      } finally {
        setIsRecalculatingNavigation(false);
      }
      if (navigationRouteIdRef.current !== route.id) return;
      setActiveRoute(plan);
      updateNavigationRoute(plan);
      if (reason || !automatic || strategy !== 'direct') {
        showToast(`${reason ? `${reason} · ` : ''}${rerouteStrategyLabels[strategy]}`);
      }
    },
    [
      navigationRoute,
      navigationLocation,
      nextStopIndex,
      updateNavigationRoute,
      isRecalculatingNavigation,
      routeIncidents,
      showToast,
    ],
  );

  // Sự cố chặn đường phía trước (trong 1,5 km) thì tính lại tuyến ngay, không đợi tới nơi mới lệch tuyến.
  const incidentDetector = useRef(new IncidentAheadDetector());
  const navigationPath = useMemo(
    () => (navigationRoute ? new RoutePath(navigationRoute.legs) : null),
    [navigationRoute],
  );
  useEffect(() => {
    if (!isNavigationIdle) return;
    incidentDetector.current.reset();
    setDemoIncidents([]); // kết thúc chuyến thì xóa sự cố giả
  }, [isNavigationIdle]);

  /** Demo: đặt một "đường đóng" giả ở phía trước xe 600 m để xem app tự né. */
  const addDemoIncidentAhead = () => {
    if (!navigationPath) return;
    const progressMeters = navigation.progressRatio * navigationPath.totalMeters;
    const point = navigationPath.pointAt(Math.min(navigationPath.totalMeters - 50, progressMeters + 600));
    setDemoIncidents((current) => [
      ...current,
      { id: `demo-${Date.now()}`, title: 'Đường đóng (demo)', ...point },
    ]);
  };
  useEffect(() => {
    if (navigationStatus !== 'navigating' || !navigationPath || isRecalculatingNavigation) return;
    const progressMeters = navigation.progressRatio * navigationPath.totalMeters;
    const ahead = incidentDetector.current.findAhead(navigationPath, progressMeters, routeIncidents);
    if (!ahead) return;
    incidentDetector.current.markHandled(ahead.incident.id); // tránh được hay không cũng chỉ xử lý một lần
    void recalculateNavigation(
      true,
      `${ahead.incident.title} phía trước ${Math.round(ahead.distanceAheadMeters)} m`,
    );
  }, [
    navigationStatus,
    navigationPath,
    navigation.progressRatio,
    routeIncidents,
    isRecalculatingNavigation,
    recalculateNavigation,
  ]);

  // Lệch tuyến đủ lâu thì tự tính lại, nhưng không dồn dập hơn AUTO_REROUTE_INTERVAL_MS.
  useEffect(() => {
    if (!offRoute || offRouteFixes < OFF_ROUTE_FIXES_BEFORE_REROUTE || isRecalculatingNavigation) return;
    const now = Date.now();
    if (now - lastAutomaticRerouteAt.current < AUTO_REROUTE_INTERVAL_MS) return;
    lastAutomaticRerouteAt.current = now;
    void recalculateNavigation(true);
  }, [offRoute, offRouteFixes, isRecalculatingNavigation, recalculateNavigation]);

  // --- Tuyến đã lưu ---
  const savePlan = (plan: RoutePlan) => {
    savedRoutes.save(plan);
    showToast('Đã lưu hành trình trên thiết bị này');
  };

  const deleteSavedRoute = (id: string) => {
    savedRoutes.remove(id);
    showToast('Đã xóa hành trình đã lưu');
  };

  const openSavedRoute = async (saved: SavedRoute) => {
    const stops =
      saved.stops && saved.stops.length > 1
        ? saved.stops
        : saved.destination
          ? [saved.origin, saved.destination]
          : [];
    if (stops.length < 2) {
      showToast('Không thể mở lại hành trình này.');
      return;
    }

    // Tuyến 2 điểm: mở trong panel chỉ đường để xem chỉ dẫn và đổi xe được.
    if (saved.kind === 'route') {
      openPanel('directions');
      const result = await directions.open({
        origin: stops[0]!,
        destination: stops[stops.length - 1]!,
        vehicle: saved.vehicle,
      });
      if (result) showToast('Đã tính lại tuyến đã lưu bằng VietMap');
      return;
    }

    // Tuyến nhiều điểm: tính lại và chỉ hiển thị trên bản đồ.
    setActiveRoute(null);
    const result = await routeApi.createPlan(stops, saved.vehicle, saved.plan?.objective ?? 'time');
    if ('error' in result) {
      showToast(result.error);
      return;
    }
    setActiveRoute(result);
    openPanel(null);
    showToast('Đã tính lại hành trình đã lưu bằng VietMap');
  };

  // --- Hành trình nhiều điểm ---
  const planMultiStopRoute = async (
    start: Place,
    stops: Place[],
    vehicle: TransportMode,
    objective: RouteObjective,
    returnToStart: boolean,
    algorithm: AlgorithmChoice,
  ): Promise<RoutePlan | { error: string }> => {
    const requestId = ++multiPlanGeneration.current;
    setActiveRoute(null);
    const result = await routeApi.createOptimizedPlan(
      [start, ...stops],
      vehicle,
      objective,
      returnToStart,
      algorithm,
    );
    if (requestId !== multiPlanGeneration.current) return { error: 'Đã hủy hành trình cũ.' };
    if ('error' in result) return result;
    setActiveRoute(result);
    setSelectedPlace(null);
    showToast('Đã tối ưu thứ tự ghé theo đường đi VietMap');
    return result;
  };

  const resetMultiStopRoute = (planId?: string) => {
    multiPlanGeneration.current++;
    if (activeRoute?.id === planId) setActiveRoute(null);
  };

  // --- Giao thông (N2): gửi và xác minh báo cáo qua API, yêu cầu đăng nhập ---
  const reportIncident = async (
    type: IncidentKind,
    severity: IncidentSeverity,
    point: LatLng,
    note: string,
    photo: File | null,
  ) => {
    if (!accessToken) {
      setAuthOpen(true);
      throw new Error('Đăng nhập để gửi báo cáo.');
    }
    await createTrafficReport(
      { incidentType: type, severity, lat: point.lat, lng: point.lng, ...(note ? { note } : {}) },
      photo ?? undefined,
    );
    setSelectedMapPoint(null);
    mapController.current?.flyTo(point, 15);
    showToast('Đã đồng bộ báo cáo giao thông');
  };

  const verifyIncident = async (id: string, state: 'clear' | 'still_active') => {
    if (!accessToken) {
      setAuthOpen(true);
      throw new Error('Đăng nhập để xác minh báo cáo.');
    }
    await updateClearance(id, state);
  };

  // --- Trợ lý địa điểm (N2): thêm/bỏ điểm ghé vào tuyến đang hiển thị ---
  const addAssistantStop = (candidate: RouteStopCandidate, expectedRouteId: string) => {
    if (!activeRoute || activeRoute.id !== expectedRouteId || activeRoute.stops.length !== 2) {
      showToast('Tuyến đã thay đổi. Hãy tìm lại điểm dừng.');
      return;
    }
    const stop = placeFromStop(candidate.place);
    setActiveRoute(
      routePlanFromResult(
        candidate.route,
        [activeRoute.stops[0]!, stop, activeRoute.stops[1]!],
        activeRoute.vehicle,
      ),
    );
    showToast(`Đã thêm điểm ghé: ${stop.name}`);
  };

  const removeAssistantStop = async () => {
    if (!activeRoute || activeRoute.stops.length < 3) return;
    const originalId = activeRoute.id;
    const result = await routeApi.createPlan(
      [activeRoute.stops[0]!, activeRoute.stops[activeRoute.stops.length - 1]!],
      activeRoute.vehicle,
    );
    if ('error' in result) {
      showToast(result.error);
      return;
    }
    setActiveRoute((current) => (current?.id === originalId ? result : current));
  };

  const routeSummary = activeRoute
    ? `${formatDistanceKm(activeRoute.distanceKm)} · ${formatDurationMinutes(activeRoute.durationMin)}`
    : '';
  const showRouteSummary = Boolean(activeRoute) && isNavigationIdle;
  const canUseAssistant = !authLoading && isAuthenticated;

  return (
    <main id="map" className="relative h-[100dvh] min-h-[560px] overflow-hidden bg-[#e8ece7] text-ink">
      <MapView
        controllerRef={mapController}
        onBoundsChange={setTrafficBounds}
        currentLocation={mapLocation}
        algorithmOverlay={
          activePanel === 'directions' && directions.waypoints.length === 0 ? comparison.overlay : null
        }
        draftStops={draftStops}
        headingDegrees={navigationHeadingDegrees}
        isPicking={pickTarget !== null}
        isNavigating={isNavigationMarkerVisible}
        layer={layer}
        onMapClick={(point) => void handleMapClick(point)}
        route={activeRoute}
        trafficLayer={trafficLayer}
      />

      <header className="app-header absolute inset-x-0 top-0 z-40 border-b border-white/80 bg-white/90 shadow-[0_2px_12px_rgba(20,37,58,.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1920px] items-center gap-3 px-3 sm:h-[68px] sm:px-5">
          <div className="flex shrink-0 items-center gap-2">
            <img src="/favicon.svg" alt="" width="32" height="32" />
            <span className="text-lg font-bold tracking-tight text-brand-700">iMap</span>
          </div>
          <div className="hidden min-w-0 max-w-[720px] flex-1 md:block">
            <PlaceSearchBar getFocus={getMapCenter} onSelect={openPlace} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {updateAvailable && (
              <>
                <span className="sr-only" role="status" aria-live="polite">
                  Có phiên bản iMap mới. Chọn Cập nhật để tải lại trang.
                </span>
                <button
                  type="button"
                  onClick={reloadForUpdate}
                  aria-label="Có phiên bản mới. Cập nhật iMap"
                  title="Có phiên bản iMap mới"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 text-[10px] font-bold text-brand-700 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 sm:h-10 sm:px-3 sm:text-[11px]"
                >
                  <Icon name="refresh" size={15} />
                  Cập nhật
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => showToast('Bản đồ nền OpenStreetMap · tuyến đường tính qua API VietMap.')}
              aria-label="Thông tin bản đồ"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
            >
              <Icon name="more" size={19} />
            </button>
            <a
              href="/login"
              aria-label={user ? `Tài khoản ${user.email ?? ''}` : 'Đăng nhập tài khoản'}
              className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ring-2 ring-white transition sm:h-10 sm:w-10 ${user ? 'bg-brand-100 text-brand-700' : 'bg-[#e8e1d7] text-[#685849]'}`}
            >
              {user?.email?.slice(0, 2).toUpperCase() ?? 'ĐN'}
            </a>
          </div>
        </div>
        <div className="px-3 pb-2 md:hidden">
          <PlaceSearchBar getFocus={getMapCenter} onSelect={openPlace} />
        </div>
      </header>

      {isNavigationIdle && (
        <FeatureNav
          isAuthenticated={isAuthenticated}
          active={activePanel}
          incidentCount={incidents.length}
          onSelect={selectFeature}
        />
      )}

      {/* Tóm tắt tuyến đang hiển thị (desktop: góc phải; mobile: trên bottom sheet). */}
      {showRouteSummary && (
        <>
          <div className="map-live-status absolute right-5 top-[140px] z-10 hidden items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur lg:flex">
            <Icon name="route" size={14} className="text-brand-600" />
            {routeSummary}
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">
              Ước tính
            </span>
          </div>
          <div
            className={`route-mobile-status absolute left-3 z-10 flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-[10px] font-bold text-ink shadow-lg shadow-slate-900/10 backdrop-blur-md md:hidden ${activePanel ? 'bottom-[calc(56dvh+62px)]' : 'bottom-[76px]'}`}
          >
            <Icon name="route" size={14} className="text-brand-600" />
            {routeSummary}
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
              Ước tính
            </span>
          </div>
        </>
      )}

      <NavigationBanner
        status={navigationStatus}
        instruction={navigation.nextInstruction}
        distanceToInstructionMeters={navigation.distanceToInstructionMeters}
        distanceRemainingMeters={navigation.distanceRemainingMeters}
        offRoute={offRoute}
        error={navigation.error}
        canRecalculate={Boolean(navigationRoute && navigationLocation)}
        isRecalculating={isRecalculatingNavigation}
        onRecalculate={() => void recalculateNavigation()}
        onRetry={() => {
          if (navigationRoute) startNavigationSession(navigationRoute, navigation.mode);
        }}
        onStop={stopNavigation}
        demo={
          demoEnabled
            ? {
                mode: navigation.mode,
                isPaused: navigation.isDemoPaused,
                onModeChange: navigation.setMode,
                onTogglePause: navigation.toggleDemoPause,
                onWrongTurn: navigation.simulateWrongTurn,
                onIncidentAhead: addDemoIncidentAhead,
              }
            : undefined
        }
      />

      {/* Hướng dẫn khi đang chọn điểm trên bản đồ. */}
      {pickTarget && (
        <div
          className="absolute left-1/2 top-[140px] z-[85] flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900/90 py-2 pl-4 pr-2 text-[11px] font-semibold text-white shadow-xl backdrop-blur max-md:top-[172px]"
          role="status"
        >
          <Icon name="pin" size={15} className="text-emerald-300" />
          Chạm vào bản đồ để chọn {pickTarget === 'origin' ? 'điểm đi' : 'điểm đến'}
          <button
            type="button"
            onClick={() => setPickTarget(null)}
            className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] hover:bg-white/25"
          >
            Hủy
          </button>
        </div>
      )}

      {activePanel === 'assistant' &&
        (canUseAssistant && user && accessToken ? (
          <Suspense fallback={<PanelFallback label="Đang mở trợ lý…" />}>
            <PlaceAssistantPanel
              key={user.id}
              accessToken={accessToken}
              route={activeRoute}
              selectedPoint={selectedMapPoint}
              getMapCenter={getMapCenter}
              onClose={closePanel}
              onFocus={(place) => mapController.current?.flyTo(place)}
              onDirections={(place) => openDirections(placeFromStop(place))}
              onAddStop={addAssistantStop}
              onRemoveStop={() => void removeAssistantStop()}
            />
          </Suspense>
        ) : (
          <AssistantAccessPanel loading={authLoading} onClose={closePanel} />
        ))}

      {activePanel === 'directions' && (
        <Suspense fallback={<PanelFallback label="Đang mở chỉ đường…" />}>
          <RoutePanel
            getSearchFocus={getMapCenter}
            comparison={comparison}
            directions={directions}
            isLocating={isLocating}
            pickTarget={pickTarget}
            onClose={closePanel}
            onPickOnMap={(target) => setPickTarget((current) => (current === target ? null : target))}
            onSave={() => {
              if (directions.route) savePlan(directions.route);
            }}
            onStartNavigation={startNavigation}
            isNavigating={isNavigating}
            onUseMyLocation={() => void setOriginFromGps()}
          />
        </Suspense>
      )}

      {/* Panel nhiều điểm được giữ lại (ẩn) sau lần mở đầu để không mất danh sách điểm đang soạn. */}
      {hasOpenedMulti && (
        <div hidden={activePanel !== 'multi'}>
          <Suspense fallback={null}>
            <MultiStopPanel
              isActive={activePanel === 'multi'}
              onShowPlan={setActiveRoute}
              onStartNavigation={startNavigation}
              isNavigating={isNavigating}
              getFocus={getMapCenter}
              onClose={closePanel}
              onPlanRoute={planMultiStopRoute}
              onReset={resetMultiStopRoute}
              onSave={savePlan}
            />
          </Suspense>
        </div>
      )}

      {activePanel === 'traffic' && (
        <Suspense fallback={<PanelFallback label="Đang mở giao thông…" />}>
          <TrafficReportPanel
            incidents={incidents}
            selectedPoint={selectedMapPoint}
            isAuthenticated={isAuthenticated}
            accessToken={accessToken}
            loading={trafficLoading}
            error={trafficError}
            onClose={closePanel}
            onSignIn={() => setAuthOpen(true)}
            onReport={reportIncident}
            onClearance={verifyIncident}
          />
        </Suspense>
      )}

      {activePanel === 'saved' && (
        <Suspense fallback={<PanelFallback label="Đang mở tuyến đã lưu…" />}>
          <SavedRoutesPanel
            routes={savedRoutes.routes}
            onClose={closePanel}
            onDelete={deleteSavedRoute}
            onOpen={(route) => void openSavedRoute(route)}
          />
        </Suspense>
      )}

      {authOpen && (
        <Suspense fallback={<PanelFallback label="Đang mở tài khoản…" />}>
          <AuthPanel onClose={() => setAuthOpen(false)} />
        </Suspense>
      )}

      {activePanel === 'place' && selectedPlace && (
        <Suspense fallback={null}>
          <PlacePanel place={selectedPlace} onClose={closePanel} onDirections={openDirections} />
        </Suspense>
      )}

      <MapToolbar
        layer={layer}
        panelOpen={activePanel !== null}
        onLayerChange={setLayer}
        onShowVietnam={() => mapController.current?.showVietnam()}
        onLocate={() => void locateOnMap()}
        onZoomIn={() => mapController.current?.zoomIn()}
        onZoomOut={() => mapController.current?.zoomOut()}
      />

      {toast && (
        <div
          className="toast-message absolute left-1/2 top-[145px] z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/70 bg-slate-900/90 px-4 py-2.5 text-center text-[11px] font-semibold text-white shadow-xl backdrop-blur max-md:top-[174px]"
          role="status"
          aria-live="polite"
        >
          <Icon name="check" size={15} className="shrink-0 text-emerald-300" />
          {toast}
        </div>
      )}
    </main>
  );
}
