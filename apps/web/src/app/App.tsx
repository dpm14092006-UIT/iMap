import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { MultiStopPanel } from '../features/multi-stop/components/MultiStopPanel';
import { SavedRoutesPanel } from '../features/my-routes/components/SavedRoutesPanel';
import type { SavedRoute } from '../features/my-routes/types';
import { demoPlaces } from '../features/map/data/demoPlaces';
import { MapToolbar } from '../features/map/components/MapToolbar';
import { MapView } from '../features/map/components/MapView';
import { LeafletMapController } from '../features/map/services/LeafletMapController';
import type { DemoPlace, FeatureKey, MapLayer, RoutePlan, TransportMode } from '../features/map/types';
import { PlacePanel } from '../features/places/components/PlacePanel';
import { PlaceSearchBar } from '../features/places/components/PlaceSearchBar';
import { RoutePanel } from '../features/navigation/components/RoutePanel';
import { RouteApiClient } from '../features/navigation/services/RouteApiClient';
import { TrafficReportPanel, type DemoIncident, type IncidentKind, type IncidentSeverity } from '../features/traffic/components/TrafficReportPanel';
import { useTrafficReports } from '../features/traffic/hooks/useTrafficReports';
import { useAuth } from '../features/auth/context/AuthProvider';
import { FeatureNav } from './components/FeatureNav';
import { Icon } from '../shared/components/Icon';

const AuthPanel = lazy(() => import('../features/auth/components/AuthPanel').then((module) => ({ default: module.AuthPanel })));

const defaultOrigin = demoPlaces.find((place) => place.id === 'ben-thanh') ?? demoPlaces[0]!;
const defaultDestination = demoPlaces.find((place) => place.id === 'landmark') ?? demoPlaces[1]!;
const routeStorageKey = 'routetwin-saved-routes-v1';
const incidentLabels: Record<IncidentKind, string> = { traffic_jam: 'Kẹt xe', accident: 'Tai nạn', construction: 'Thi công', flood: 'Ngập đường', road_closure: 'Đường đóng', obstacle: 'Vật cản' };

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled by the browser. */ }
}

function readSavedRoutes(): SavedRoute[] {
  return readStored<SavedRoute[]>(routeStorageKey, []).filter((route) => Boolean(route?.origin && route?.origin.name && route?.kind));
}

function formatDuration(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${Math.round(minutes % 60)} phút` : `${Math.max(1, Math.round(minutes))} phút`;
}

export function App() {
  const { user, accessToken } = useAuth();
  const { reports, error: trafficError, loading: trafficLoading, create: createTrafficReport, clearance: updateClearance } = useTrafficReports(accessToken, user?.id ?? null);
  const routeApi = useMemo(() => new RouteApiClient(), []);
  const mapController = useRef<LeafletMapController | null>(null);
  const [activePanel, setActivePanel] = useState<FeatureKey | null>('directions');
  const [selectedPlace, setSelectedPlace] = useState<DemoPlace | null>(null);
  const [initialOrigin, setInitialOrigin] = useState<DemoPlace>(defaultOrigin);
  const [initialDestination, setInitialDestination] = useState<DemoPlace | null>(defaultDestination);
  const [activeRoute, setActiveRoute] = useState<RoutePlan | null>(null);
  const [layer, setLayer] = useState<MapLayer>('street');
  const [selectedMapPoint, setSelectedMapPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(readSavedRoutes);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => { writeStored(routeStorageKey, savedRoutes); }, [savedRoutes]);

  const incidents = useMemo<DemoIncident[]>(() => reports.map((report) => ({
    id: report.id,
    type: report.incidentType,
    severity: report.severity,
    description: report.note || incidentLabels[report.incidentType],
    time: new Date(report.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    lat: report.lat,
    lng: report.lng,
    communityReportCount: report.communityReportCount ?? 1,
    communityReporterCount: report.communityReporterCount ?? 0,
    communityUpdatedAt: report.communityUpdatedAt ?? undefined,
    imagePath: report.imagePath,
    status: report.status,
  })), [reports]);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  };

  const routeDistance = activeRoute ? `${activeRoute.distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km` : '';
  const routeDuration = activeRoute ? formatDuration(activeRoute.durationMin) : '';

  const openPlace = (place: DemoPlace) => {
    setSelectedPlace(place);
    setActivePanel('place');
    mapController.current?.flyTo(place);
  };

  const findRoute = async (origin: DemoPlace, destination: DemoPlace, mode: TransportMode) => {
    setInitialOrigin(origin);
    setInitialDestination(destination);
    setActiveRoute(null);
    const result = await routeApi.createPlan([origin, destination], mode);
    if ('error' in result) {
      return result;
    }
    setActiveRoute(result);
    setSelectedPlace(null);
    showToast('Đã tính tuyến theo đường bằng VietMap');
    return result;
  };

  const savePlan = (plan: RoutePlan) => {
    const first = plan.stops[0]!;
    const last = plan.stops[plan.stops.length - 1]!;
    const title = plan.kind === 'multi' ? `Hành trình ${Math.max(0, plan.stops.length - 1)} điểm · ${first.name}` : `${first.name} → ${last.name}`;
    const item: SavedRoute = {
      id: `${plan.id}-${Date.now()}`,
      kind: plan.kind,
      title,
      origin: first,
      destination: last,
      stops: plan.stops,
      vehicle: plan.vehicle,
      plan,
      originId: first.id,
      originName: first.name,
      destinationId: last.id,
      destinationName: last.name,
    };
    setSavedRoutes((current) => [item, ...current.filter((route) => route.title !== title)]);
    showToast('Đã lưu hành trình trên thiết bị này');
  };

  const saveRoute = async (origin: DemoPlace, destination: DemoPlace) => {
    const plan = activeRoute?.kind === 'route' && activeRoute.stops[0]?.id === origin.id && activeRoute.stops[1]?.id === destination.id
      ? activeRoute
      : await routeApi.createPlan([origin, destination], activeRoute?.vehicle ?? 'motorcycle');
    if ('error' in plan) {
      showToast(plan.error);
      return;
    }
    savePlan(plan);
  };

  const openSavedRoute = async (saved: SavedRoute) => {
    const stops = saved.stops?.length && saved.stops.length > 1
      ? saved.stops
      : saved.destination ? [saved.origin, saved.destination] : [];
    if (stops.length < 2) {
      showToast('Không thể mở lại hành trình này.');
      return;
    }
    setActiveRoute(null);
    const result = await routeApi.createPlan(stops, saved.vehicle, saved.plan?.objective ?? 'time');
    if ('error' in result) {
      showToast(result.error);
      return;
    }
    setActiveRoute(result);
    setInitialOrigin(result.stops[0]!);
    setInitialDestination(result.stops[result.stops.length - 1]!);
    setSelectedPlace(null);
    if (result.kind === 'route') setActivePanel('directions');
    else setActivePanel(null);
    showToast('Đã tính lại hành trình đã lưu bằng VietMap');
  };

  const reportIncident = async (type: IncidentKind, severity: IncidentSeverity, point: { lat: number; lng: number }, note: string, photo: File | null) => {
    if (!accessToken) {
      setAuthOpen(true);
      throw new Error('Đăng nhập để gửi báo cáo.');
    }
    await createTrafficReport({ incidentType: type, severity, lat: point.lat, lng: point.lng, ...(note ? { note } : {}) }, photo ?? undefined);
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

  const openDirections = (place: DemoPlace) => {
    setInitialOrigin(currentLocation ? { id: 'current-location', name: 'Vị trí của tôi', district: 'GPS thiết bị', category: 'Vị trí hiện tại', lat: currentLocation.lat, lng: currentLocation.lng } : defaultOrigin);
    setInitialDestination(place);
    setActiveRoute(null);
    setSelectedPlace(null);
    setActivePanel('directions');
  };

  const selectFeature = (key: FeatureKey) => {
    setSelectedPlace(null);
    setActivePanel(key);
    if (key === 'traffic') setSelectedMapPoint(null);
  };

  const handleMapClick = (point: { lat: number; lng: number }) => {
    if (activePanel === 'traffic') {
      setSelectedMapPoint(point);
      return;
    }
    if (activePanel === 'directions' && !activeRoute) {
      let nearest = defaultOrigin;
      let nearestDistance = Infinity;
      for (const place of demoPlaces) {
        const distance = (place.lat - point.lat) ** 2 + (place.lng - point.lng) ** 2;
        if (distance < nearestDistance) {
          nearest = place;
          nearestDistance = distance;
        }
      }
      if (Math.abs(nearest.lat - point.lat) < 0.002 && Math.abs(nearest.lng - point.lng) < 0.002) openPlace(nearest);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) {
      showToast('Thiết bị này không hỗ trợ định vị.');
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCurrentLocation(point);
      mapController.current?.flyTo(point, 16);
      showToast(`Đã định vị · sai số khoảng ${Math.round(position.coords.accuracy)} m`);
    }, () => showToast('Không lấy được vị trí. Hãy cấp quyền định vị cho trình duyệt.'), { enableHighAccuracy: true, timeout: 9000 });
  };

  return (
    <main id="map" className="relative h-[100dvh] min-h-[560px] overflow-hidden bg-[#e8ece7] text-ink">
      <MapView
        controllerRef={mapController}
        currentLocation={currentLocation}
        incidents={incidents}
        layer={layer}
        onMapClick={handleMapClick}
        onSelectPlace={openPlace}
        places={demoPlaces}
        route={activeRoute}
        selectedPlaceId={selectedPlace?.id ?? null}
      />

      <header className="app-header absolute inset-x-0 top-0 z-40 border-b border-white/80 bg-white/90 shadow-[0_2px_12px_rgba(20,37,58,.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1920px] items-center gap-3 px-3 sm:h-[68px] sm:px-5">
          <div className="hidden min-w-0 max-w-[720px] flex-1 md:block"><PlaceSearchBar onSelect={openPlace} /></div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-600 lg:inline-flex"><Icon name="pin" size={13} className="text-brand-600" />TP. Hồ Chí Minh</span>
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />OpenStreetMap</span>
            <button type="button" onClick={() => showToast('Bản đồ nền OpenStreetMap · tuyến đường tính qua API VietMap.')} aria-label="Thông tin bản đồ" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-brand-200 hover:text-brand-700"><Icon name="more" size={19} /></button>
            <a href="/login" aria-label={user ? `Tài khoản ${user.email ?? ''}` : 'Đăng nhập tài khoản'} className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ring-2 ring-white transition sm:h-10 sm:w-10 ${user ? 'bg-brand-100 text-brand-700' : 'bg-[#e8e1d7] text-[#685849]'}`}>{user?.email?.slice(0, 2).toUpperCase() ?? 'ĐN'}</a>
          </div>
        </div>
        <div className="px-3 pb-2 md:hidden"><PlaceSearchBar onSelect={openPlace} /></div>
      </header>

      <FeatureNav active={activePanel} incidentCount={incidents.length} onSelect={selectFeature} />

      <div className="map-live-status absolute right-5 top-[140px] z-10 hidden items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur lg:flex">
        {activeRoute ? <><Icon name="route" size={14} className="text-brand-600" />{routeDistance} · {routeDuration}<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">Ước tính</span></> : <><span className="h-2 w-2 rounded-full bg-emerald-500" />Bản đồ TP. Hồ Chí Minh</>}
      </div>

      {activeRoute && <div className="route-mobile-status absolute bottom-[calc(56dvh+10px)] left-3 z-10 flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-[10px] font-bold text-ink shadow-lg shadow-slate-900/10 backdrop-blur-md md:hidden"><Icon name="route" size={14} className="text-brand-600" />{routeDistance} · {routeDuration}<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Ước tính</span></div>}

      {activePanel === 'directions' && <RoutePanel initialDestination={initialDestination} initialOrigin={initialOrigin} onClose={() => setActivePanel(null)} onOriginChange={(place) => { if (place) setInitialOrigin(place); setActiveRoute(null); }} onDestinationChange={(place) => { setInitialDestination(place); setActiveRoute(null); }} onClearRoute={() => setActiveRoute(null)} onPreview={findRoute} onSave={(origin, destination) => { void saveRoute(origin, destination); }} route={activeRoute} />}
      {activePanel === 'multi' && <MultiStopPanel onClose={() => setActivePanel(null)} onPlanRoute={async (start, stops, mode, objective, returnToStart) => {
        const routeStops = [start, ...stops, ...(returnToStart ? [start] : [])];
        setActiveRoute(null);
        const result = await routeApi.createPlan(routeStops, mode, objective);
        if ('error' in result) return result;
        setActiveRoute(result);
        setSelectedPlace(null);
        showToast('Đã tính tuyến qua các điểm bằng VietMap');
        return result;
      }} onSave={savePlan} />}
      {activePanel === 'traffic' && <TrafficReportPanel incidents={incidents} selectedPoint={selectedMapPoint} isAuthenticated={Boolean(accessToken)} accessToken={accessToken} loading={trafficLoading} error={trafficError} onClose={() => setActivePanel(null)} onSignIn={() => setAuthOpen(true)} onReport={reportIncident} onClearance={verifyIncident} />}
      {activePanel === 'saved' && <SavedRoutesPanel routes={savedRoutes} onClose={() => setActivePanel(null)} onDelete={(id) => { setSavedRoutes((current) => current.filter((route) => route.id !== id)); showToast('Đã xóa hành trình đã lưu'); }} onOpen={openSavedRoute} />}
      {authOpen && <Suspense fallback={<div className="absolute left-5 top-[143px] z-40 rounded-xl bg-white px-4 py-3 text-xs font-medium text-slate-600 shadow-float max-md:bottom-4 max-md:left-3 max-md:top-auto" role="status">Đang mở tài khoản…</div>}><AuthPanel onClose={() => setAuthOpen(false)} /></Suspense>}
      {activePanel === 'place' && selectedPlace && <PlacePanel place={selectedPlace} onClose={() => setActivePanel(null)} onDirections={openDirections} />}

      <MapToolbar
        layer={layer}
        onLayerChange={setLayer}
        onLocate={locate}
        onZoomIn={() => mapController.current?.zoomIn()}
        onZoomOut={() => mapController.current?.zoomOut()}
      />

      <div className="map-city-label absolute bottom-6 left-5 z-10 max-w-[280px] rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md max-md:hidden">
        <p className="text-[12px] font-bold text-ink">Thành phố Hồ Chí Minh</p>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">Chọn điểm trên bản đồ hoặc tìm địa chỉ ở thanh tìm kiếm</p>
      </div>

      {toast && <div className="toast-message absolute left-1/2 top-[145px] z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/70 bg-slate-900/90 px-4 py-2.5 text-center text-[11px] font-semibold text-white shadow-xl backdrop-blur max-md:top-[174px]" role="status" aria-live="polite"><Icon name="check" size={15} className="shrink-0 text-emerald-300" />{toast}</div>}
    </main>
  );
}
