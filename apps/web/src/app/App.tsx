import type { RouteStopCandidate, StopPlace, TrafficReportBounds } from '@routetwin/shared';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssistantAccessPanel } from '../features/auth/components/AssistantAccessPanel';
import { useAuth } from '../features/auth/context/AuthProvider';
import { AlongRouteSearch } from '../features/explore/components/AlongRouteSearch';
import { AreaInsightCard, AreaInsightPill } from '../features/explore/components/AreaInsightCard';
import { poiMetaFor, sameTerm } from '../features/explore/data/poiCatalog';
import { CategoryChips } from '../features/explore/components/CategoryChips';
import { PoiResultsPanel } from '../features/explore/components/PoiResultsPanel';
import { usePoiSearch } from '../features/explore/hooks/usePoiSearch';
import { computeAreaInsight } from '../features/explore/services/areaInsight';
import { ApiPoiProvider } from '../features/explore/services/apiPoiProvider';
import { radiusForZoom, ALONG_ROUTE_RADIUS_M } from '../features/explore/services/poiOptions';
import type { Poi, PoiSearchTerm } from '../features/explore/types';
import { LayerSwitcher } from '../features/map/components/LayerSwitcher';
import { MapControls } from '../features/map/components/MapControls';
import { MapView } from '../features/map/components/MapView';
import { useCurrentLocation } from '../features/map/hooks/useCurrentLocation';
import { useTimeBasedMapLayer } from '../features/map/hooks/useTimeBasedMapLayer';
import type { LeafletMapController } from '../features/map/services/LeafletMapController';
import type {
  DraftStops,
  FeatureKey,
  MapOverlays,
  RouteObjective,
  RoutePlan,
  TransportMode,
} from '../features/map/types';
import type { AlgorithmChoice } from '../features/multi-stop/utils/algorithms';
import { useSavedRoutes } from '../features/my-routes/hooks/useSavedRoutes';
import type { SavedRoute } from '../features/my-routes/types';
import { NavigationBanner } from '../features/navigation/components/NavigationBanner';
import type { PickTarget } from '../features/navigation/components/RoutePanel';
import { TrafficLegend } from '../features/map/components/TrafficLegend';
import { useAlgorithmComparison } from '../features/navigation/hooks/useAlgorithmComparison';
import { useDirections } from '../features/navigation/hooks/useDirections';
import { useNavigationSession } from '../features/navigation/hooks/useNavigationSession';
import { RouteApiClient, routePlanFromResult } from '../features/navigation/services/RouteApiClient';
import { parseRouteShareLink } from '../features/navigation/services/routeShareLink';
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
import { popularPlaces } from '../features/places/data/popularPlaces';
import { basicPlaceFromPoint, placeFromPoint } from '../features/places/services/placeFromPoint';
import type { LatLng, Place } from '../features/places/types';
import { vietnamBounds } from '../features/traffic/api/trafficApi';
import type {
  IncidentKind,
  IncidentSeverity,
  TrafficVehicleScope,
} from '../features/traffic/components/TrafficReportPanel';
import { useTrafficReports, type RealtimeTrafficReport } from '../features/traffic/hooks/useTrafficReports';
import {
  incidentLabels,
  toIncidents,
  toReportsMapLayer,
} from '../features/traffic/services/trafficPresentation';
import { shouldNotifyTrafficReportOnRoute } from '../features/traffic/services/routeTraffic';
import { Icon } from '../shared/components/Icon';
import { progressAlongPath } from '../shared/geo/path';
import { PanelFallback } from './components/PanelFallback';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useNow } from './hooks/useNow';
import { useToast } from './hooks/useToast';
import { AppShell, type SheetState } from './layout/AppShell';
import { SideDock } from './layout/SideDock';
import { TopBar } from './layout/TopBar';

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
/** Khi bản đồ đang xem toàn quốc, khám phá quanh đây mặc định ở trung tâm TP.HCM. */
const DEFAULT_EXPLORE_CENTER: LatLng = { lat: 10.7769, lng: 106.7009 };
/** Dưới mức zoom này thì chưa đủ gần để khám phá quanh đây. */
const MIN_EXPLORE_ZOOM = 11;
const NO_POIS: Poi[] = [];

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

/** Địa điểm thật (POI) dưới dạng Place dùng chung cho chi tiết, chỉ đường và điểm dừng. */
function placeFromPoi(poi: Poi): Place {
  return {
    id: poi.id,
    name: poi.name,
    address: poi.address,
    category: poiMetaFor(poi.category).label,
    lat: poi.lat,
    lng: poi.lng,
    source: 'poi',
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
  const { layer, setLayer, isDark } = useTimeBasedMapLayer(); // tối tự động 18:00–06:00
  const savedRoutes = useSavedRoutes();
  const { updateAvailable, reloadForUpdate } = useAppUpdate();

  const [activePanel, setActivePanel] = useState<FeatureKey | null>(() =>
    // Điện thoại mở vào bản đồ trống cho thoáng (trừ link chia sẻ tuyến); desktop/tablet mở sẵn chỉ đường.
    window.matchMedia('(max-width: 767px)').matches && !parseRouteShareLink(window.location.search)
      ? null
      : 'directions',
  );
  const [hasOpenedMulti, setHasOpenedMulti] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedMapPoint, setSelectedMapPoint] = useState<LatLng | null>(null);
  const [activeRoute, setActiveRoute] = useState<RoutePlan | null>(null);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [trafficBounds, setTrafficBounds] = useState<TrafficReportBounds>(vietnamBounds);
  const [overlays, setOverlays] = useState<MapOverlays>({ traffic: true, incidents: true, terrain: false });
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [highlightedPoiId, setHighlightedPoiId] = useState<string | null>(null);
  // Mỗi lần đổi `key`, MultiStopPanel được dựng lại với danh sách điểm điền sẵn.
  const [multiSeed, setMultiSeed] = useState<{
    key: number;
    initialStops?: { start: Place | null; stops: Place[] };
  }>({ key: 0 });
  const poiProvider = useMemo(() => new ApiPoiProvider(), []);
  const now = useNow(5 * 60_000);

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
  const notifiedRealtimeReports = useRef(new Map<string, number>());
  const onRealtimeTrafficReport = useCallback(
    (report: RealtimeTrafficReport) => {
      const route = navigationRoute ?? activeRoute;
      if (!route || !shouldNotifyTrafficReportOnRoute(route, report)) return;

      const version = report.version ?? 1;
      if ((notifiedRealtimeReports.current.get(report.id) ?? 0) >= version) return;
      notifiedRealtimeReports.current.set(report.id, version);
      if (notifiedRealtimeReports.current.size > 120) {
        const oldestId = notifiedRealtimeReports.current.keys().next().value;
        if (oldestId) notifiedRealtimeReports.current.delete(oldestId);
      }

      const severityLabel: Record<IncidentSeverity, string> = { low: 'nhẹ', medium: 'vừa', high: 'nặng' };
      const incidentLabel = incidentLabels[report.incidentType as IncidentKind] ?? 'Sự cố giao thông';
      showToast(
        `Cảnh báo tuyến: ${incidentLabel} mức ${severityLabel[report.severity]}. Đã cập nhật đoạn đường.`,
      );
    },
    [activeRoute, navigationRoute, showToast],
  );
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

  // Bản đồ bám theo vị trí GPS trong lúc dẫn đường; người dùng tự kéo / zoom thì tạm ngừng bám
  // để xem trước hành trình, bấm "Về vị trí" để bám lại.
  const [followPaused, setFollowPaused] = useState(false);
  useEffect(() => {
    if (isNavigationIdle) {
      setFollowPaused(false);
      return;
    }
    return mapController.current?.onUserGesture(() => setFollowPaused(true));
  }, [isNavigationIdle]);
  useEffect(() => {
    if (
      !followPaused &&
      navigationLocation &&
      (navigationStatus === 'navigating' || navigationStatus === 'arrived')
    ) {
      mapController.current?.followLocation(navigationLocation);
    }
  }, [navigationLocation, navigationStatus, followPaused]);
  const recenterNavigation = useCallback(() => {
    setFollowPaused(false);
    if (navigationLocation) mapController.current?.followLocation(navigationLocation);
  }, [navigationLocation]);
  const previewNavigationRoute = useCallback(() => {
    if (!navigationRoute) return;
    setFollowPaused(true);
    mapController.current?.fitRoute(navigationRoute);
  }, [navigationRoute]);

  // --- Giao thông (N2): báo cáo lấy từ API; bản đồ nhận qua hợp đồng TrafficMapLayer. ---
  const {
    reports,
    error: trafficError,
    loading: trafficLoading,
    create: createTrafficReport,
    clearance: updateClearance,
  } = useTrafficReports(
    accessToken,
    user?.id ?? null,
    trafficBounds,
    activePanel === 'traffic' || Boolean(navigationRoute ?? activeRoute),
    onRealtimeTrafficReport,
  );
  const directions = useDirections({
    routeApi,
    activeRoute,
    onRouteChange: setActiveRoute,
    initialOrigin: null,
    initialDestination: null,
  });
  const reportVehicle = navigationRoute?.vehicle ?? activeRoute?.vehicle ?? directions.vehicle;
  const visibleReports = useMemo(
    () => reports.filter((report) => report.vehicleScope === 'both' || report.vehicleScope === reportVehicle),
    [reports, reportVehicle],
  );
  const incidents = useMemo(() => toIncidents(visibleReports), [visibleReports]);
  const reportsLayer = useMemo(() => toReportsMapLayer(visibleReports), [visibleReports]);
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
                  vehicleScope: 'both' as const,
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
  const routeOptionsForMap = useMemo(
    () => (activePanel === 'directions' && directions.route ? directions.routeOptions : []),
    [activePanel, directions.route, directions.routeOptions],
  );

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
      if (event.key !== 'Escape') return;
      event.preventDefault(); // để panel không đóng theo cùng phím Esc
      setPickTarget(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pickTarget]);

  const openPanel = (key: FeatureKey | null) => {
    setActivePanel(key);
    if (key === 'multi') setHasOpenedMulti(true);
    setPickTarget(null);
  };
  const closePanel = () => openPanel(null);

  const selectFeature = (key: FeatureKey) => {
    setSelectedPlace(null);
    setSelectedPoi(null);
    openPanel(key);
    if (key === 'traffic') setSelectedMapPoint(null);
  };

  const openPlace = (place: Place, poi: Poi | null = null) => {
    setSelectedPlace(place);
    setSelectedPoi(poi);
    openPanel('place');
    mapController.current?.flyTo(place);
  };

  /** "Tìm đường đến đây" từ panel chi tiết: điểm đến = địa điểm, điểm đi = GPS nếu đã định vị. */
  const openDirections = (place: Place) => {
    if (currentLocation) directions.setOrigin(basicPlaceFromPoint(currentLocation, 'gps'));
    directions.setDestination(place);
    setSelectedPlace(null);
    setSelectedPoi(null);
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
    vehicleScope: TrafficVehicleScope,
    point: LatLng,
    note: string,
    photo: File | null,
  ) => {
    if (!accessToken) {
      setAuthOpen(true);
      throw new Error('Đăng nhập để gửi báo cáo.');
    }
    const report = await createTrafficReport(
      {
        incidentType: type,
        severity,
        vehicleScope,
        lat: point.lat,
        lng: point.lng,
        ...(note ? { note } : {}),
      },
      photo ?? undefined,
    );
    setSelectedMapPoint(null);
    mapController.current?.flyTo(point, 15);
    showToast(
      report.vehicleScope === vehicleScope
        ? 'Đã đồng bộ báo cáo giao thông'
        : 'Đã gửi báo cáo; Supabase chưa cập nhật phân luồng, cảnh báo tạm áp dụng cho cả ô tô và xe máy.',
    );
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

  // --- Khám phá quanh đây / tìm dọc tuyến (địa điểm thật qua PoiProvider -> backend -> VietMap) ---
  const mapCenterForPoi = useMemo<LatLng>(
    () => ({
      lat: (trafficBounds.minLat + trafficBounds.maxLat) / 2,
      lng: (trafficBounds.minLng + trafficBounds.maxLng) / 2,
    }),
    [trafficBounds],
  );
  const routePath = useMemo(
    () => (activeRoute ? activeRoute.legs.flatMap((leg) => leg.points) : null),
    [activeRoute],
  );
  const poi = usePoiSearch({ provider: poiProvider, mapCenter: mapCenterForPoi, routePath });
  const poiVisible =
    poi.request !== null && (activePanel === 'poi' || (activePanel === 'place' && selectedPoi !== null));
  const visiblePois = poiVisible ? poi.pois : NO_POIS;

  const closePoi = () => {
    poi.close();
    setHighlightedPoiId(null);
    if (activePanel === 'poi') closePanel();
  };

  const startPoiSearch = (mode: 'nearby' | 'alongRoute', term: PoiSearchTerm) => {
    // Bấm lại chip đang chọn thì đóng; gõ lại cùng từ khóa thì tìm lại.
    if (term.category && poiVisible && poi.request?.mode === mode && sameTerm(poi.request.term, term)) {
      closePoi();
      return;
    }
    let anchor = getMapCenter();
    let zoom = mapController.current?.getZoom() ?? 0;
    if (mode === 'nearby' && zoom < MIN_EXPLORE_ZOOM) {
      anchor = currentLocation ?? DEFAULT_EXPLORE_CENTER;
      zoom = 14;
      mapController.current?.flyTo(anchor, zoom);
      showToast('Đang khám phá quanh TP.HCM. Hãy phóng to bản đồ tới khu vực bạn muốn.');
    }
    const radiusM = mode === 'alongRoute' ? ALONG_ROUTE_RADIUS_M : radiusForZoom(zoom);
    poi.open({ mode, term }, anchor, radiusM);
    setSelectedPlace(null);
    setSelectedPoi(null);
    openPanel('poi');
  };

  const selectPoi = (item: Poi) => {
    openPlace(placeFromPoi(item), item);
  };
  const closePlacePanel = () => {
    setSelectedPoi(null);
    if (poi.request) openPanel('poi');
    else closePanel();
  };

  const directionsToPoi = (item: Poi) => {
    poi.close();
    setHighlightedPoiId(null);
    openDirections(placeFromPoi(item));
  };

  /** Chèn POI làm điểm ghé giữa điểm đi và đến (theo vị trí dọc tuyến), tính lại tuyến rồi về panel chỉ đường. */
  const addPoiStop = async (item: Poi) => {
    const { origin, destination, route } = directions;
    if (!origin || !destination || !route) return;
    const path = route.legs.flatMap((leg) => leg.points);
    const stop = placeFromPoi(item);
    const via = [
      ...directions.waypoints.flatMap((waypoint) => (waypoint.place ? [waypoint.place] : [])),
      stop,
    ]
      .filter((place, index, all) => all.findIndex((other) => other.id === place.id) === index)
      .sort((a, b) => progressAlongPath(path, a) - progressAlongPath(path, b));
    poi.close();
    setHighlightedPoiId(null);
    openPanel('directions');
    const result = await directions.open({
      origin,
      destination,
      vehicle: directions.vehicle,
      via,
      objective: directions.objective,
      avoidFerry: directions.avoidFerry,
    });
    if (result) showToast(`Đã thêm điểm dừng: ${item.name}`);
  };

  const toggleSavedPoi = (item: Poi) => {
    poi.toggleSaved(item.id);
    showToast(poi.savedIds.has(item.id) ? 'Đã bỏ lưu địa điểm' : `Đã lưu ${item.name}`);
  };

  /** "+ Thêm điểm đến": chuyển sang luồng nhiều điểm, mang theo điểm đi và các điểm đã chọn. */
  const continueInMultiStop = () => {
    const stops = [
      ...directions.waypoints.flatMap((waypoint) => (waypoint.place ? [waypoint.place] : [])),
      ...(directions.destination ? [directions.destination] : []),
    ];
    setMultiSeed((current) => ({
      key: current.key + 1,
      initialStops: { start: directions.origin, stops },
    }));
    setSelectedPlace(null);
    openPanel('multi');
  };

  // Bảng chức năng đổi kích thước (đổi nấc kéo, mở/đóng panel): báo cho bản đồ và zoom lại tuyến
  // vừa phần bản đồ còn nhìn thấy. Chỉ zoom lại khi đã dừng kéo (inset khác null) và đang xem tuyến.
  const routeFitActive =
    Boolean(activeRoute) && isNavigationIdle && (activePanel === 'directions' || activePanel === 'multi');
  const routeFitActiveRef = useRef(routeFitActive);
  routeFitActiveRef.current = routeFitActive;
  const lastSheetInset = useRef<SheetState['inset']>(null);
  const sheetFitTimer = useRef<number | undefined>(undefined);
  const handleSheetChange = useCallback((sheet: SheetState) => {
    const controller = mapController.current;
    if (!controller) return;
    controller.setFitInsets(sheet.inset);
    const previous = lastSheetInset.current;
    if (!sheet.inset) return;
    lastSheetInset.current = sheet.inset;
    if (previous && previous.left === sheet.inset.left && previous.bottom === sheet.inset.bottom) return;
    window.clearTimeout(sheetFitTimer.current);
    // Đợi hết hiệu ứng đổi chiều cao (200ms) rồi mới zoom lại.
    sheetFitTimer.current = window.setTimeout(() => {
      if (routeFitActiveRef.current) mapController.current?.refit();
    }, 260);
  }, []);
  useEffect(() => () => window.clearTimeout(sheetFitTimer.current), []);

  const previewRoute = (route: RoutePlan) => {
    directions.chooseRoute(route.id);
    mapController.current?.fitRoute(route);
  };

  // Liên kết chia sẻ ?from=…&to=…&mode=… tự điền điểm đi/đến và tính tuyến khi tải trang.
  const sharedRoute = useMemo(() => parseRouteShareLink(window.location.search), []);
  const sharedRouteApplied = useRef(false);
  useEffect(() => {
    if (!sharedRoute || sharedRouteApplied.current) return;
    sharedRouteApplied.current = true;
    void directions.open(sharedRoute);
  }, [sharedRoute, directions]);

  const areaInsight = useMemo(() => computeAreaInsight(incidents.length, now), [incidents.length, now]);
  const openTrafficPanel = () => selectFeature('traffic');

  const routeSummary = activeRoute
    ? `${formatDistanceKm(activeRoute.distanceKm)} · ${formatDurationMinutes(activeRoute.durationMin)}`
    : '';
  const showRouteSummary = Boolean(activeRoute) && isNavigationIdle && activePanel !== 'directions';
  const canUseAssistant = !authLoading && isAuthenticated;
  const panelOpen = activePanel !== null || authOpen;
  const alongRouteMode =
    Boolean(activeRoute) && (activePanel === 'directions' || poi.request?.mode === 'alongRoute');
  const activeCategory = poiVisible && poi.request ? (poi.request.term.category ?? null) : null;

  return (
    <AppShell
      dark={isDark}
      onSheetChange={handleSheetChange}
      panelOpen={panelOpen && isNavigationIdle}
      map={
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
          overlays={overlays}
          pois={visiblePois}
          highlightedPoiId={highlightedPoiId}
          onMapClick={(point) => void handleMapClick(point)}
          onSelectRoute={directions.chooseRoute}
          onPoiClick={(id) => {
            const item = poi.pois.find((candidate) => candidate.id === id);
            if (item) selectPoi(item);
          }}
          route={activeRoute}
          routeOptions={routeOptionsForMap}
          trafficLayer={trafficLayer}
        />
      }
      dock={
        isNavigationIdle && (
          <SideDock
            isAuthenticated={isAuthenticated}
            active={activePanel}
            incidentCount={incidents.length}
            onSelect={selectFeature}
          />
        )
      }
      topBar={
        isNavigationIdle && (
          <TopBar
            getFocus={getMapCenter}
            onSelectPlace={openPlace}
            updateAvailable={updateAvailable}
            onUpdate={reloadForUpdate}
            onInfo={() => showToast('Bản đồ nền OpenStreetMap · tuyến đường tính qua API VietMap.')}
            userEmail={user?.email ?? null}
            strip={
              alongRouteMode ? (
                <AlongRouteSearch
                  active={poi.request?.mode === 'alongRoute' ? activeCategory : null}
                  onSelect={(term) => startPoiSearch('alongRoute', term)}
                />
              ) : (
                <CategoryChips
                  active={poi.request?.mode === 'nearby' ? activeCategory : null}
                  onSelect={(term) => startPoiSearch('nearby', term)}
                />
              )
            }
          />
        )
      }
      bottomLeft={
        <>
          {overlays.traffic && (
            <div className="md:order-2 md:mx-auto">
              <TrafficLegend onHide={() => setOverlays((current) => ({ ...current, traffic: false }))} />
            </div>
          )}
          <LayerSwitcher
            layer={layer}
            overlays={overlays}
            onLayerChange={setLayer}
            onOverlaysChange={setOverlays}
          />
          {isNavigationIdle && !panelOpen && (
            <div className="md:hidden">
              <AreaInsightPill insight={areaInsight} onOpenTraffic={openTrafficPanel} />
            </div>
          )}
        </>
      }
      bottomRight={
        <MapControls
          showZoom={!isNavigationIdle}
          onShowVietnam={() => {
            if (!isNavigationIdle) setFollowPaused(true);
            mapController.current?.showVietnam();
          }}
          onLocate={() => (isNavigationIdle ? void locateOnMap() : recenterNavigation())}
          onZoomIn={() => {
            if (!isNavigationIdle) setFollowPaused(true);
            mapController.current?.zoomIn();
          }}
          onZoomOut={() => {
            if (!isNavigationIdle) setFollowPaused(true);
            mapController.current?.zoomOut();
          }}
        />
      }
    >
      {/* Thẻ "Khu vực này" dưới ô tìm kiếm khi chưa mở panel nào (mobile dùng viên thuốc phía dưới). */}
      {isNavigationIdle && !panelOpen && (
        <div className="absolute top-[72px] z-20 hidden w-[360px] md:left-[80px] md:block lg:left-[88px] lg:w-[400px]">
          <AreaInsightCard insight={areaInsight} onOpenTraffic={openTrafficPanel} />
        </div>
      )}

      {/* Tóm tắt tuyến đang hiển thị khi panel chỉ đường đã đóng (nhiều điểm, tuyến đã lưu…). */}
      {showRouteSummary && (
        <div className="absolute right-3 top-[68px] z-10 flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-ink shadow-glass dark:shadow-glass-dark ring-1 ring-black/5 backdrop-blur-xl max-md:top-[112px] dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10">
          <Icon name="route" size={14} className="text-brand-600 dark:text-indigo-300" />
          {routeSummary}
          <span className="rounded-full bg-amber-100 dark:bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200">
            Ước tính
          </span>
        </div>
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
        onReport={() => {
          const point = navigationLocation ?? currentLocation;
          setSelectedMapPoint(point);
          openPanel('traffic');
          if (point) mapController.current?.flyTo(point, 16);
          else showToast('Đang chờ GPS để gắn báo cáo vào vị trí hiện tại.');
        }}
        onStop={stopNavigation}
        followPaused={followPaused}
        atTop={activePanel !== null}
        onRecenter={recenterNavigation}
        onPreviewRoute={previewNavigationRoute}
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
          className="absolute left-1/2 top-[76px] z-[85] flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900/90 py-2 pl-4 pr-2 text-xs font-semibold text-white shadow-glass dark:shadow-glass-dark ring-1 ring-white/15 backdrop-blur-xl max-md:top-[116px]"
          role="status"
        >
          <Icon name="pin" size={15} className="text-teal-300" />
          Chạm vào bản đồ để chọn {pickTarget === 'origin' ? 'điểm đi' : 'điểm đến'}
          <button
            type="button"
            onClick={() => setPickTarget(null)}
            className="rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
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
            trafficLayer={trafficLayer}
            isLocating={isLocating}
            pickTarget={pickTarget}
            onClose={closePanel}
            onPickOnMap={(target) => setPickTarget((current) => (current === target ? null : target))}
            onSave={() => {
              if (directions.route) savePlan(directions.route);
            }}
            onStartNavigation={startNavigation}
            onPreviewRoute={previewRoute}
            onAddDestination={continueInMultiStop}
            isNavigating={isNavigating}
            onUseMyLocation={() => void setOriginFromGps()}
          />
        </Suspense>
      )}

      {/* Panel nhiều điểm được giữ lại (ẩn) sau lần mở đầu để không mất danh sách điểm đang soạn. */}
      {hasOpenedMulti && (
        <Suspense fallback={null}>
          <MultiStopPanel
            key={multiSeed.key}
            {...(multiSeed.initialStops ? { initialStops: multiSeed.initialStops } : {})}
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
      )}

      {activePanel === 'poi' && poi.request && (
        <PoiResultsPanel
          term={poi.request.term}
          mode={poi.request.mode}
          search={poi}
          highlightedId={highlightedPoiId}
          canAddStop={poi.request.mode === 'alongRoute' && Boolean(directions.route)}
          onHover={setHighlightedPoiId}
          onSelect={selectPoi}
          onDirections={directionsToPoi}
          onToggleSave={toggleSavedPoi}
          onAddStop={(item) => void addPoiStop(item)}
          {...(poi.request.mode === 'alongRoute'
            ? {
                onBack: () => {
                  poi.close();
                  setHighlightedPoiId(null);
                  openPanel('directions');
                },
              }
            : {})}
          onClose={closePoi}
        />
      )}

      {activePanel === 'traffic' && (
        <Suspense fallback={<PanelFallback label="Đang mở giao thông…" />}>
          <TrafficReportPanel
            incidents={incidents}
            selectedPoint={selectedMapPoint}
            isAuthenticated={isAuthenticated}
            accessToken={accessToken}
            defaultVehicle={reportVehicle}
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
          <PlacePanel
            place={selectedPlace}
            poi={selectedPoi}
            onClose={closePlacePanel}
            onDirections={openDirections}
          />
        </Suspense>
      )}

      {toast && (
        <div
          className="toast-message absolute left-1/2 top-[76px] z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-glass dark:shadow-glass-dark ring-1 ring-white/15 backdrop-blur-xl max-md:top-[116px]"
          role="status"
          aria-live="polite"
        >
          <Icon name="check" size={15} className="shrink-0 text-teal-300" />
          {toast}
        </div>
      )}
    </AppShell>
  );
}
