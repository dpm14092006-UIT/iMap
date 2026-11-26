import type { TrafficReportBounds } from '@routetwin/shared';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssistantAccessPanel } from '../features/auth/components/AssistantAccessPanel';
import { useAuth } from '../features/auth/context/AuthProvider';
import { AlongRouteSearch } from '../features/explore/components/AlongRouteSearch';
import { AreaInsightCard, AreaInsightPill } from '../features/explore/components/AreaInsightCard';
import { CategoryChips } from '../features/explore/components/CategoryChips';
import { PoiResultsPanel } from '../features/explore/components/PoiResultsPanel';
import { computeAreaInsight } from '../features/explore/domain/areaInsight';
import { NavigationBanner } from '../features/guidance/components/NavigationBanner';
import { Speedometer } from '../features/guidance/components/Speedometer';
import { RoutePath } from '../features/guidance/domain/RoutePath';
import { useNavigationAudio } from '../features/guidance/hooks/useNavigationAudio';
import { useNavigationSession } from '../features/guidance/hooks/useNavigationSession';
import { LayerSwitcher } from '../features/map/components/LayerSwitcher';
import { MapControls } from '../features/map/components/MapControls';
import { MapView } from '../features/map/components/MapView';
import { TrafficLegend } from '../features/map/components/TrafficLegend';
import { useCurrentLocation } from '../features/map/hooks/useCurrentLocation';
import { useMapAppearance } from '../features/map/hooks/useMapAppearance';
import type { LeafletMapController } from '../features/map/services/LeafletMapController';
import type { DraftStops, MapOverlays } from '../features/map/types';
import { useSavedRoutes } from '../features/my-routes/hooks/useSavedRoutes';
import { PushPermissionCard } from '../features/notifications/components/PushPermissionCard';
import { placeFromStop } from '../features/place-assistant/domain/stopPlace';
import { findPopularPlaceNear } from '../features/places/domain/nearbyPopularPlace';
import { RouteApiClient } from '../features/routing/api/RouteApiClient';
import { useDirections } from '../features/routing/hooks/useDirections';
import type { RoutePlan } from '../features/routing/types';
import { vietnamBounds } from '../features/traffic/api/trafficApi';
import { RouteTrafficAlert } from '../features/traffic/components/RouteTrafficAlert';
import { useTrafficReports } from '../features/traffic/hooks/useTrafficReports';
import type { LatLng } from '../shared/geo/types';
import { useI18n } from '../shared/i18n/I18nProvider';
import { errorMessage } from '../shared/text/errorMessage';
import { usePoiExplorer } from './flows/explore/usePoiExplorer';
import { useNavigationFollow } from './flows/guidance/useNavigationFollow';
import { useNavigationRerouting } from './flows/guidance/useNavigationRerouting';
import { useAssistantStops } from './flows/routes/useAssistantStops';
import { useEndpointPicker } from './flows/routes/useEndpointPicker';
import { useMultiStopPlanner } from './flows/routes/useMultiStopPlanner';
import { useRecentRouteEndpoints } from './flows/routes/useRecentRouteEndpoints';
import { useSavedRouteActions } from './flows/routes/useSavedRouteActions';
import { useSharedRouteLink } from './flows/routes/useSharedRouteLink';
import { useRealtimeRouteReports } from './flows/traffic/useRealtimeRouteReports';
import { useRouteAlerts } from './flows/traffic/useRouteAlerts';
import { useTrafficOverview } from './flows/traffic/useTrafficOverview';
import { useTrafficReporting } from './flows/traffic/useTrafficReporting';
import { useMapViewport } from './flows/workspace/useMapViewport';
import { usePanelState } from './flows/workspace/usePanelState';
import { usePlaceSelection } from './flows/workspace/usePlaceSelection';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useNow } from './hooks/useNow';
import { useToast } from './hooks/useToast';
import {
  AuthPanel,
  MultiStopPanel,
  PlaceAssistantPanel,
  PlacePanel,
  RoutePanel,
  SavedRoutesPanel,
  TrafficReportPanel,
} from './lazyPanels';
import { AppShell } from './shell/AppShell';
import { MapPickHint } from './shell/MapPickHint';
import { PanelFallback } from './shell/PanelFallback';
import { RouteSummaryPill } from './shell/RouteSummaryPill';
import { SideDock } from './shell/SideDock';
import { StatusToast } from './shell/StatusToast';
import { TopBar } from './shell/TopBar';
import type { FeatureKey } from './types';

/** Tâm Việt Nam, dùng khi bản đồ chưa sẵn sàng để trả tâm thật. */
const VIETNAM_CENTER: LatLng = { lat: 16, lng: 108 };
const AREA_INSIGHT_REFRESH_MS = 5 * 60_000;

/**
 * Khung ứng dụng: lắp bản đồ với các panel chức năng.
 * Trạng thái dùng chung (tuyến đang vẽ, panel đang mở, vị trí GPS) nằm ở đây; mỗi luồng điều phối
 * nhiều feature nằm trong một hook của `app/flows`, logic riêng của từng chức năng nằm trong feature đó.
 */
export function App() {
  const { t } = useI18n();
  const routeApi = useMemo(() => new RouteApiClient(), []);
  const mapController = useRef<LeafletMapController | null>(null);
  const getMapCenter = useCallback(() => mapController.current?.getCenter() ?? VIETNAM_CENTER, []);
  const { toast, showToast } = useToast();
  const { location: currentLocation, locate } = useCurrentLocation();
  const { user, accessToken, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user && !user.is_anonymous && accessToken);
  const { layer, preference, setLayer, isDark } = useMapAppearance();
  const savedRoutes = useSavedRoutes();
  const { updateAvailable, reloadForUpdate } = useAppUpdate();
  const now = useNow(AREA_INSIGHT_REFRESH_MS);

  const panels = usePanelState();
  const { activePanel, openPanel, closePanel, pickTarget, setPickTarget } = panels;
  const [activeRoute, setActiveRoute] = useState<RoutePlan | null>(null);
  const [trafficBounds, setTrafficBounds] = useState<TrafficReportBounds>(vietnamBounds);
  const [overlays, setOverlays] = useState<MapOverlays>({ traffic: true, incidents: true, terrain: false });

  // --- Dẫn đường theo GPS ---
  const navigation = useNavigationSession();
  const {
    status: navigationStatus,
    route: navigationRoute,
    location: navigationLocation,
    displayLocation: navigationDisplayLocation,
    stop: stopNavigation,
    updateRoute: updateNavigationRoute,
  } = navigation;
  const isNavigationIdle = navigationStatus === 'idle';
  const isNavigating = navigationStatus === 'navigating' || navigationStatus === 'locating';
  const navigationPath = useMemo(
    () => (navigationRoute ? new RoutePath(navigationRoute.legs) : null),
    [navigationRoute],
  );
  const follow = useNavigationFollow(mapController, {
    status: navigationStatus,
    route: navigationRoute,
    displayLocation: navigationDisplayLocation,
  });
  // Tuyến trên bản đồ bị thay bằng tuyến khác thì dừng chuyến đang dẫn.
  useEffect(() => {
    if (navigationRoute && !isNavigationIdle && activeRoute?.id !== navigationRoute.id) stopNavigation();
  }, [activeRoute?.id, navigationRoute, isNavigationIdle, stopNavigation]);
  /** Đổi sang tuyến mới (tính lại / tránh sự cố): cập nhật cả bản đồ và chuyến đang dẫn. */
  const applyRouteChange = (plan: RoutePlan) => {
    setActiveRoute(plan);
    if (navigationRoute) updateNavigationRoute(plan);
  };

  // --- Giao thông: báo cáo từ API + Realtime; bản đồ nhận qua hợp đồng TrafficMapLayer ---
  const realtime = useRealtimeRouteReports(navigationRoute ?? activeRoute);
  const traffic = useTrafficReports(
    accessToken,
    user?.id ?? null,
    trafficBounds,
    activePanel === 'traffic' || Boolean(navigationRoute ?? activeRoute),
    realtime.onRealtimeTrafficReport,
  );
  const directions = useDirections({ routeApi, activeRoute, onRouteChange: setActiveRoute });
  const reportVehicle = navigationRoute?.vehicle ?? activeRoute?.vehicle ?? directions.vehicle;
  const { incidents, trafficLayer, routeIncidents } = useTrafficOverview({
    reports: traffic.reports,
    vehicle: reportVehicle,
    t,
  });

  const rerouting = useNavigationRerouting({
    navigation,
    routeIncidents,
    onRerouted: applyRouteChange,
    showToast,
    t,
  });
  const alerts = useRouteAlerts({
    navigation,
    navigationPath,
    activeRoute,
    reports: traffic.reports,
    trafficLayer,
    routeIncidents,
    isRecalculating: rerouting.isRecalculating,
    isAuthenticated,
    onAcceptPlan: applyRouteChange,
    soundEnabled: () => navigationAudio.enabled,
    setReportHandler: realtime.setHandler,
    t,
  });
  const { routeAlert } = alerts;
  const navigationAudio = useNavigationAudio({
    routeId: navigationRoute?.id ?? activeRoute?.id ?? null,
    status: navigationStatus,
    offRoute: navigation.offRoute,
    instruction: navigation.nextInstruction,
    instructionIndex: navigation.nextInstruction
      ? (navigationRoute?.legs.flatMap((leg) => leg.instructions ?? []).indexOf(navigation.nextInstruction) ??
        -1)
      : -1,
    distanceMeters: navigation.distanceToInstructionMeters,
    alert: routeAlert.alert,
  });
  useRecentRouteEndpoints(activeRoute);

  // --- Bản đồ, panel và địa điểm đang chọn ---
  const routeFitActive =
    Boolean(activeRoute) && isNavigationIdle && (activePanel === 'directions' || activePanel === 'multi');
  const viewport = useMapViewport(mapController, routeFitActive);
  const selection = usePlaceSelection({
    openPanel,
    focusAfterPanel: viewport.focusAfterPanel,
    directions,
    currentLocation,
  });
  const { selectedPlace, selectedPoi, selectedMapPoint, setSelectedMapPoint } = selection;
  const picker = useEndpointPicker({ directions, locate, mapController, showToast, t });
  const multiStop = useMultiStopPlanner({
    routeApi,
    activePanel,
    activeRoute,
    setActiveRoute,
    onPlanned: selection.clearPlace,
    showToast,
    t,
  });
  const savedRouteActions = useSavedRouteActions({
    savedRoutes,
    directions,
    multiStop,
    routeApi,
    setActiveRoute,
    openPanel,
    showToast,
    t,
  });
  const assistantStops = useAssistantStops({ activeRoute, setActiveRoute, routeApi, showToast, t });
  const reporting = useTrafficReporting({
    accessToken,
    createReport: traffic.create,
    updateClearance: traffic.clearance,
    openSignIn: () => panels.setAuthOpen(true),
    onReported: () => setSelectedMapPoint(null),
    mapController,
    showToast,
    t,
  });
  const explorer = usePoiExplorer({
    trafficBounds,
    activeRoute,
    activePanel,
    openPanel,
    selection,
    directions,
    currentLocation,
    mapController,
    getMapCenter,
    showToast,
    t,
  });
  useSharedRouteLink(directions);

  // Marker A/B cho điểm đã chọn nhưng chưa tính tuyến (chỉ khi panel chỉ đường đang mở).
  const draftStops = useMemo<DraftStops>(
    () =>
      activePanel === 'directions'
        ? { origin: directions.origin, destination: directions.destination }
        : {
            origin: null,
            destination: null,
            // Quán/điểm POI đã có ghim riêng; địa chỉ, địa danh thì cần ghim đánh dấu.
            focus: activePanel === 'place' && !selectedPoi ? selectedPlace : null,
          },
    [activePanel, directions.origin, directions.destination, selectedPlace, selectedPoi],
  );
  const routeOptionsForMap = useMemo(
    () => (activePanel === 'directions' && directions.route ? directions.routeOptions : []),
    [activePanel, directions.route, directions.routeOptions],
  );
  const areaInsight = useMemo(() => computeAreaInsight(incidents.length, now), [incidents.length, now]);

  // --- Hành động của người dùng ---
  const selectFeature = (key: FeatureKey) => {
    selection.clearPlace();
    openPanel(key);
    if (key === 'traffic') setSelectedMapPoint(null);
  };
  const openTrafficPanel = () => selectFeature('traffic');

  /** Click bản đồ: tùy panel đang mở mà xử lý khác nhau. */
  const handleMapClick = (point: LatLng) => {
    if (pickTarget) {
      setPickTarget(null);
      void picker.pickPoint(pickTarget, point);
      return;
    }
    if (activePanel === 'traffic' || activePanel === 'assistant') {
      setSelectedMapPoint(point);
      return;
    }
    const nearby = findPopularPlaceNear(point);
    if (nearby && !activeRoute) selection.openPlace(nearby);
  };

  /** Nút định vị trên thanh công cụ bản đồ. */
  const locateOnMap = async () => {
    try {
      const fix = await locate();
      mapController.current?.flyTo(fix.point, 16);
      showToast(t('Đã định vị · sai số khoảng {meters} m', { meters: fix.accuracyMeters }));
    } catch (error) {
      showToast(t(errorMessage(error, 'Không lấy được vị trí.')));
    }
  };

  const startNavigation = (route: RoutePlan) => {
    navigationAudio.begin();
    navigation.start(route);
    openPanel(null);
  };

  const previewRoute = (route: RoutePlan) => {
    directions.chooseRoute(route.id);
    mapController.current?.fitRoute(route);
  };

  const reportFromNavigation = () => {
    const point = navigationLocation ?? currentLocation;
    setSelectedMapPoint(point);
    openPanel('traffic');
    if (point) viewport.focusAfterPanel(point, 16);
    else showToast(t('Đang chờ GPS để gắn báo cáo vào vị trí hiện tại.'));
  };

  const canUseAssistant = !authLoading && isAuthenticated;
  const { panelOpen } = panels;
  const layerSwitcherProps = {
    layer,
    preference,
    overlays,
    onLayerChange: setLayer,
    onOverlaysChange: setOverlays,
  };

  return (
    <AppShell
      dark={isDark}
      onSheetChange={viewport.handleSheetChange}
      panelOpen={panelOpen && isNavigationIdle}
      map={
        <MapView
          controllerRef={mapController}
          onBoundsChange={setTrafficBounds}
          // Mũi tên dẫn đường vẽ ở vị trí đã hút về tuyến; vị trí GPS thô vẫn dùng cho tính lại tuyến và báo cáo.
          currentLocation={isNavigationIdle ? currentLocation : navigationDisplayLocation}
          draftStops={draftStops}
          headingDegrees={navigation.headingDegrees}
          isPicking={pickTarget !== null}
          isNavigating={navigationStatus !== 'idle' && navigationStatus !== 'error'}
          layer={layer}
          overlays={overlays}
          pois={explorer.visiblePois}
          highlightedPoiId={explorer.highlightedId}
          onMapClick={handleMapClick}
          onSelectRoute={directions.chooseRoute}
          onPoiClick={explorer.selectById}
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
            onSelectPlace={(place) => selection.openPlace(place)}
            buildSearchAction={explorer.buildSearchAction}
            updateAvailable={updateAvailable}
            onUpdate={reloadForUpdate}
            onInfo={() =>
              showToast(
                t(
                  'Bản đồ nền vApp (map.vapp.vn), Vietmap và VNSDI (Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam) · tuyến đường tính qua API VietMap.',
                ),
              )
            }
            userEmail={user?.email ?? null}
            strip={
              explorer.alongRouteMode ? (
                <AlongRouteSearch
                  active={explorer.search.request?.mode === 'alongRoute' ? explorer.activeCategory : null}
                  onSelect={(term) => explorer.start('alongRoute', term)}
                />
              ) : (
                <CategoryChips
                  active={explorer.search.request?.mode === 'nearby' ? explorer.activeCategory : null}
                  onSelect={(term) => explorer.start('nearby', term)}
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
          {isNavigationIdle && <LayerSwitcher {...layerSwitcherProps} />}
          {isNavigationIdle && !panelOpen && (
            <div className="md:hidden">
              <AreaInsightPill insight={areaInsight} onOpenTraffic={openTrafficPanel} />
            </div>
          )}
        </>
      }
      bottomRight={
        <>
          {!isNavigationIdle && <LayerSwitcher align="right" {...layerSwitcherProps} />}
          <MapControls
            showZoom={!isNavigationIdle}
            onShowVietnam={() => {
              follow.pauseIfNavigating();
              mapController.current?.showVietnam();
            }}
            onLocate={() => (isNavigationIdle ? void locateOnMap() : follow.recenter())}
            onZoomIn={() => {
              follow.pauseIfNavigating();
              mapController.current?.zoomIn();
            }}
            onZoomOut={() => {
              follow.pauseIfNavigating();
              mapController.current?.zoomOut();
            }}
          />
        </>
      }
    >
      {/* Thẻ "Khu vực này" dưới ô tìm kiếm khi chưa mở panel nào (mobile dùng viên thuốc phía dưới). */}
      {isNavigationIdle && !panelOpen && (
        <div className="absolute top-[72px] z-20 hidden w-[360px] md:left-[80px] md:block lg:left-[88px] lg:w-[400px]">
          <AreaInsightCard insight={areaInsight} onOpenTraffic={openTrafficPanel} />
        </div>
      )}

      {activeRoute && isNavigationIdle && activePanel !== 'directions' && (
        <RouteSummaryPill route={activeRoute} />
      )}

      {!isNavigationIdle && navigationStatus !== 'arrived' && (
        <Speedometer
          speedKph={navigation.speedKph}
          hasGpsFix={navigationStatus === 'navigating' && !navigation.error}
          belowBanner={activePanel !== null}
        />
      )}

      <NavigationBanner
        status={navigationStatus}
        instruction={navigation.nextInstruction}
        distanceToInstructionMeters={navigation.distanceToInstructionMeters}
        distanceRemainingMeters={navigation.distanceRemainingMeters}
        offRoute={navigation.offRoute}
        error={navigation.error}
        canRecalculate={Boolean(navigationRoute && navigationLocation)}
        isRecalculating={rerouting.isRecalculating}
        onRecalculate={() => void rerouting.recalculate()}
        onRetry={() => {
          if (navigationRoute) {
            navigationAudio.begin();
            navigation.start(navigationRoute);
          }
        }}
        audio={navigationAudio}
        onReport={reportFromNavigation}
        onStop={stopNavigation}
        followPaused={follow.followPaused}
        atTop={activePanel !== null}
        onRecenter={follow.recenter}
        onPreviewRoute={follow.previewRoute}
      />

      {pickTarget && <MapPickHint target={pickTarget} onCancel={() => setPickTarget(null)} />}

      {activePanel === 'assistant' &&
        (canUseAssistant && user && accessToken ? (
          <Suspense fallback={<PanelFallback label={t('Đang mở trợ lý…')} />}>
            <PlaceAssistantPanel
              key={user.id}
              accessToken={accessToken}
              route={activeRoute}
              selectedPoint={selectedMapPoint}
              getMapCenter={getMapCenter}
              onClose={closePanel}
              onFocus={(place) => mapController.current?.flyTo(place)}
              onDirections={(place) => selection.openDirections(placeFromStop(place))}
              onAddStop={assistantStops.add}
              onRemoveStop={() => void assistantStops.remove()}
            />
          </Suspense>
        ) : (
          <AssistantAccessPanel loading={authLoading} onClose={closePanel} />
        ))}

      {activePanel === 'directions' && (
        <Suspense fallback={<PanelFallback label={t('Đang mở chỉ đường…')} />}>
          <RoutePanel
            getSearchFocus={getMapCenter}
            directions={directions}
            trafficLayer={trafficLayer}
            isLocating={picker.isLocating}
            pickTarget={pickTarget}
            onClose={closePanel}
            onPickOnMap={(target) => setPickTarget((current) => (current === target ? null : target))}
            onSave={() => {
              if (directions.route)
                savedRouteActions.save(directions.route, {
                  avoidFerry: directions.avoidFerry,
                  panel: 'directions',
                });
            }}
            onStartNavigation={startNavigation}
            onPreviewRoute={previewRoute}
            isNavigating={isNavigating}
            onUseMyLocation={() => void picker.useMyLocationAsOrigin()}
          />
        </Suspense>
      )}

      {/* Panel nhiều điểm được giữ lại (ẩn) sau lần mở đầu để không mất danh sách điểm đang soạn. */}
      {panels.hasOpenedMulti && (
        <Suspense fallback={null}>
          <MultiStopPanel
            isActive={activePanel === 'multi'}
            onShowPlan={setActiveRoute}
            onStartNavigation={startNavigation}
            isNavigating={isNavigating}
            getFocus={getMapCenter}
            onClose={closePanel}
            onPlanRoute={multiStop.plan}
            onReset={multiStop.reset}
            onSave={savedRouteActions.save}
          />
        </Suspense>
      )}

      {activePanel === 'poi' && explorer.search.request && (
        <PoiResultsPanel
          term={explorer.search.request.term}
          mode={explorer.search.request.mode}
          search={explorer.search}
          highlightedId={explorer.highlightedId}
          canAddStop={explorer.search.request.mode === 'alongRoute' && Boolean(directions.route)}
          onHover={explorer.setHighlightedId}
          onSelect={explorer.select}
          onDirections={explorer.directionsTo}
          onToggleSave={explorer.toggleSaved}
          onAddStop={(item) => void explorer.addStop(item)}
          {...(explorer.search.request.mode === 'alongRoute'
            ? {
                onBack: () => {
                  explorer.dismiss();
                  openPanel('directions');
                },
              }
            : {})}
          onClose={explorer.close}
        />
      )}

      {activePanel === 'traffic' && (
        <Suspense fallback={<PanelFallback label={t('Đang mở giao thông…')} />}>
          <TrafficReportPanel
            incidents={incidents}
            selectedPoint={selectedMapPoint}
            isAuthenticated={isAuthenticated}
            accessToken={accessToken}
            defaultVehicle={reportVehicle}
            loading={traffic.loading}
            error={traffic.error}
            onClose={closePanel}
            onSignIn={() => panels.setAuthOpen(true)}
            onReport={reporting.report}
            onClearance={reporting.verify}
          />
        </Suspense>
      )}

      {activePanel === 'saved' && (
        <Suspense fallback={<PanelFallback label={t('Đang mở tuyến đã lưu…')} />}>
          <SavedRoutesPanel
            routes={savedRoutes.routes}
            onClose={closePanel}
            onDelete={savedRouteActions.remove}
            onOpen={(route) => void savedRouteActions.open(route)}
          />
        </Suspense>
      )}

      {panels.authOpen && (
        <Suspense fallback={<PanelFallback label={t('Đang mở tài khoản…')} />}>
          <AuthPanel onClose={() => panels.setAuthOpen(false)} />
        </Suspense>
      )}

      {activePanel === 'place' && selectedPlace && (
        <Suspense fallback={null}>
          <PlacePanel
            place={selectedPlace}
            poi={selectedPoi}
            onClose={explorer.closePlacePanel}
            onDirections={selection.openDirections}
          />
        </Suspense>
      )}

      {routeAlert.alert && alerts.alertCommunity && (
        <RouteTrafficAlert
          alert={routeAlert.alert}
          community={alerts.alertCommunity}
          onAccept={routeAlert.accept}
          onKeep={routeAlert.keep}
          belowNavigationBanner={!isNavigationIdle && activePanel !== null}
          onClose={routeAlert.close}
        />
      )}

      {alerts.pushCard.visible && (
        <PushPermissionCard
          busy={alerts.push.busy}
          error={alerts.push.error}
          isAuthenticated={isAuthenticated}
          onEnable={() => {
            void alerts.push.enable().then((enabled) => {
              if (enabled) {
                alerts.pushCard.hide();
                showToast(t('Đã bật thông báo cảnh báo giao thông trên tuyến'));
              }
            });
          }}
          onDismiss={alerts.pushCard.dismiss}
          onSignIn={() => reporting.requireSignIn(t('Đăng nhập để nhận thông báo kẹt xe trên tuyến.'))}
        />
      )}

      {toast && <StatusToast message={toast} />}
    </AppShell>
  );
}
