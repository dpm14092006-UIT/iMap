import { useEffect, useMemo, useRef, useState } from 'react';
import { AiVisionPanel } from '../features/ai-vision/components/AiVisionPanel';
import { MapToolbar } from '../features/map/components/MapToolbar';
import { MapView } from '../features/map/components/MapView';
import { useCurrentLocation } from '../features/map/hooks/useCurrentLocation';
import { toTrafficMapLayer } from '../features/map/layers/trafficMapLayer';
import type { LeafletMapController } from '../features/map/services/LeafletMapController';
import type { DraftStops, FeatureKey, MapLayer, RoutePlan } from '../features/map/types';
import { MultiStopPanel } from '../features/multi-stop/components/MultiStopPanel';
import { SavedRoutesPanel } from '../features/my-routes/components/SavedRoutesPanel';
import type { SavedRoute } from '../features/my-routes/types';
import { RoutePanel, type PickTarget } from '../features/navigation/components/RoutePanel';
import { useDirections } from '../features/navigation/hooks/useDirections';
import { RouteApiClient } from '../features/navigation/services/RouteApiClient';
import { formatDistanceKm, formatDurationMinutes } from '../features/navigation/utils/format';
import { PlacePanel } from '../features/places/components/PlacePanel';
import { PlaceSearchBar } from '../features/places/components/PlaceSearchBar';
import { findPopularPlace, popularPlaces } from '../features/places/data/popularPlaces';
import { basicPlaceFromPoint, placeFromPoint } from '../features/places/services/placeFromPoint';
import type { LatLng, Place } from '../features/places/types';
import { TrafficReportPanel, type DemoIncident, type IncidentKind, type IncidentSeverity } from '../features/traffic/components/TrafficReportPanel';
import { Icon } from '../shared/components/Icon';
import { FeatureNav } from './components/FeatureNav';
import { useToast } from './hooks/useToast';

// Điểm đi/đến mặc định khi mở app lần đầu.
const defaultOrigin = findPopularPlace('ben-thanh') ?? null;
const defaultDestination = findPopularPlace('landmark') ?? null;

// Khóa localStorage. Tăng "v2" vì kiểu Place đã đổi (district -> address).
const incidentStorageKey = 'routetwin-traffic-reports-v1';
const routeStorageKey = 'routetwin-saved-routes-v2';

/** Khoảng cách (độ) tối đa để coi một click là "chọn" địa điểm gợi ý gần đó (~200 m). */
const PLACE_CLICK_TOLERANCE = 0.002;

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Trình duyệt có thể chặn storage. */ }
}

function readIncidents(): DemoIncident[] {
  const now = Date.now();
  const reports = readStored<(DemoIncident & { expiresAt?: number })[]>(incidentStorageKey, []);
  return reports.filter((report) => Number.isFinite(report.lat) && Number.isFinite(report.lng) && (!report.expiresAt || report.expiresAt > now));
}

function readSavedRoutes(): SavedRoute[] {
  return readStored<SavedRoute[]>(routeStorageKey, []).filter((route) => Boolean(route?.origin?.name && route?.kind));
}

/** Địa điểm gợi ý gần điểm click nhất, hoặc null nếu không có điểm nào đủ gần. */
function findPlaceNear(point: LatLng): Place | null {
  return popularPlaces.find((place) => Math.abs(place.lat - point.lat) < PLACE_CLICK_TOLERANCE && Math.abs(place.lng - point.lng) < PLACE_CLICK_TOLERANCE) ?? null;
}

/**
 * Khung ứng dụng: ghép bản đồ với các panel chức năng.
 * Trạng thái dùng chung (tuyến đang vẽ, panel đang mở, vị trí GPS) nằm ở đây;
 * logic riêng của từng chức năng nằm trong hook/component của feature tương ứng.
 */
export function App() {
  const routeApi = useMemo(() => new RouteApiClient(), []);
  const mapController = useRef<LeafletMapController | null>(null);
  const { toast, showToast } = useToast();
  const { location: currentLocation, locate } = useCurrentLocation();

  const [activePanel, setActivePanel] = useState<FeatureKey | null>('directions');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeRoute, setActiveRoute] = useState<RoutePlan | null>(null);
  const [layer, setLayer] = useState<MapLayer>('street');
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(readSavedRoutes);

  // --- Phần traffic (N2): tạm lưu trên trình duyệt, chuyển sang TrafficMapLayer để bản đồ vẽ. ---
  const [incidents, setIncidents] = useState<DemoIncident[]>(readIncidents);
  const [selectedMapPoint, setSelectedMapPoint] = useState<LatLng | null>(null);
  const trafficLayer = useMemo(() => toTrafficMapLayer(incidents.map((incident) => ({
    id: incident.id,
    incidentType: incident.type,
    severity: incident.severity,
    title: incident.description,
    lat: incident.lat,
    lng: incident.lng,
  }))), [incidents]);

  const directions = useDirections({
    routeApi,
    activeRoute,
    onRouteChange: setActiveRoute,
    initialOrigin: defaultOrigin,
    initialDestination: defaultDestination,
  });

  // Marker A/B cho điểm đã chọn nhưng chưa tính tuyến (chỉ khi panel chỉ đường đang mở).
  const draftStops = useMemo<DraftStops>(
    () => activePanel === 'directions' ? { origin: directions.origin, destination: directions.destination } : { origin: null, destination: null },
    [activePanel, directions.origin, directions.destination],
  );

  useEffect(() => { writeStored(incidentStorageKey, incidents); }, [incidents]);
  useEffect(() => { writeStored(routeStorageKey, savedRoutes); }, [savedRoutes]);

  // Nhấn Esc để thoát chế độ chọn điểm trên bản đồ.
  useEffect(() => {
    if (!pickTarget) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPickTarget(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickTarget]);

  const openPanel = (key: FeatureKey | null) => {
    setActivePanel(key);
    setPickTarget(null);
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
    // 2. Panel giao thông: chọn vị trí sự cố.
    if (activePanel === 'traffic') {
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
      showToast(error instanceof Error ? error.message : 'Không lấy được vị trí.');
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
      showToast(error instanceof Error ? error.message : 'Không lấy được vị trí.');
    } finally {
      setIsLocating(false);
    }
  };

  // --- My Routes (sẽ chuyển sang API ở ngày 4) ---
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

  const openSavedRoute = async (saved: SavedRoute) => {
    const stops = saved.stops && saved.stops.length > 1 ? saved.stops : saved.destination ? [saved.origin, saved.destination] : [];
    if (stops.length < 2) {
      showToast('Không thể mở lại hành trình này.');
      return;
    }

    // Tuyến 2 điểm: mở trong panel chỉ đường để xem chỉ dẫn và đổi xe được.
    if (saved.kind === 'route') {
      openPanel('directions');
      const result = await directions.open({ origin: stops[0]!, destination: stops[stops.length - 1]!, vehicle: saved.vehicle });
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

  // --- Traffic (N2) ---
  const reportIncident = (type: IncidentKind, severity: IncidentSeverity, point: LatLng) => {
    const labels: Record<IncidentKind, string> = { traffic_jam: 'Kẹt xe', accident: 'Tai nạn', construction: 'Thi công', flood: 'Ngập đường', road_closure: 'Đường đóng', obstacle: 'Vật cản' };
    const report: DemoIncident = { id: `report-${Date.now()}`, type, severity, description: labels[type], time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), lat: point.lat, lng: point.lng };
    setIncidents((current) => [report, ...current]);
    setSelectedMapPoint(null);
    mapController.current?.flyTo(point, 15);
    showToast('Đã lưu báo cáo giao thông trên thiết bị này');
  };

  const selectFeature = (key: FeatureKey) => {
    setSelectedPlace(null);
    openPanel(key);
    if (key === 'traffic') setSelectedMapPoint(null);
  };

  const routeSummary = activeRoute ? `${formatDistanceKm(activeRoute.distanceKm)} · ${formatDurationMinutes(activeRoute.durationMin)}` : '';

  return (
    <main id="map" className="relative h-[100dvh] min-h-[560px] overflow-hidden bg-[#e8ece7] text-ink">
      <MapView
        controllerRef={mapController}
        currentLocation={currentLocation}
        draftStops={draftStops}
        isPicking={pickTarget !== null}
        layer={layer}
        onMapClick={(point) => { void handleMapClick(point); }}
        onSelectPlace={(place) => { if (!pickTarget) openPlace(place); }}
        places={popularPlaces}
        route={activeRoute}
        selectedPlaceId={selectedPlace?.id ?? null}
        trafficLayer={trafficLayer}
      />

      <header className="app-header absolute inset-x-0 top-0 z-40 border-b border-white/80 bg-white/90 shadow-[0_2px_12px_rgba(20,37,58,.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1920px] items-center gap-3 px-3 sm:h-[68px] sm:px-5">
          <div className="hidden min-w-0 max-w-[720px] flex-1 md:block"><PlaceSearchBar onSelect={openPlace} /></div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-600 lg:inline-flex"><Icon name="pin" size={13} className="text-brand-600" />TP. Hồ Chí Minh</span>
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />OpenStreetMap</span>
            <button type="button" onClick={() => showToast('Bản đồ nền OpenStreetMap · tuyến đường tính qua API VietMap.')} aria-label="Thông tin bản đồ" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-brand-200 hover:text-brand-700"><Icon name="more" size={19} /></button>
            <button type="button" onClick={() => showToast('Đăng nhập sẽ đồng bộ tuyến giữa các thiết bị khi bật dịch vụ tài khoản.')} aria-label="Tài khoản" className="grid h-9 w-9 place-items-center rounded-full bg-[#e8e1d7] text-xs font-bold text-[#685849] ring-2 ring-white sm:h-10 sm:w-10">DT</button>
          </div>
        </div>
        <div className="px-3 pb-2 md:hidden"><PlaceSearchBar onSelect={openPlace} /></div>
      </header>

      <FeatureNav active={activePanel} incidentCount={incidents.length} onSelect={selectFeature} />

      {/* Tóm tắt tuyến đang hiển thị (desktop: góc phải; mobile: trên bottom sheet). */}
      <div className="map-live-status absolute right-5 top-[140px] z-10 hidden items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur lg:flex">
        {activeRoute ? <><Icon name="route" size={14} className="text-brand-600" />{routeSummary}<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">Ước tính</span></> : <><span className="h-2 w-2 rounded-full bg-emerald-500" />Bản đồ TP. Hồ Chí Minh</>}
      </div>
      {activeRoute && <div className="route-mobile-status absolute bottom-[calc(56dvh+10px)] left-3 z-10 flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-[10px] font-bold text-ink shadow-lg shadow-slate-900/10 backdrop-blur-md md:hidden"><Icon name="route" size={14} className="text-brand-600" />{routeSummary}<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Ước tính</span></div>}

      {/* Hướng dẫn khi đang chọn điểm trên bản đồ. */}
      {pickTarget && (
        <div className="absolute left-1/2 top-[140px] z-[85] flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900/90 py-2 pl-4 pr-2 text-[11px] font-semibold text-white shadow-xl backdrop-blur max-md:top-[172px]" role="status">
          <Icon name="pin" size={15} className="text-emerald-300" />
          Chạm vào bản đồ để chọn {pickTarget === 'origin' ? 'điểm đi' : 'điểm đến'}
          <button type="button" onClick={() => setPickTarget(null)} className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] hover:bg-white/25">Hủy</button>
        </div>
      )}

      {activePanel === 'directions' && (
        <RoutePanel
          directions={directions}
          isLocating={isLocating}
          pickTarget={pickTarget}
          onClose={() => openPanel(null)}
          onPickOnMap={(target) => setPickTarget((current) => current === target ? null : target)}
          onSave={() => { if (directions.route) savePlan(directions.route); }}
          onUseMyLocation={() => { void setOriginFromGps(); }}
        />
      )}
      {activePanel === 'multi' && <MultiStopPanel onClose={() => openPanel(null)} onPlanRoute={async (start, stops, mode, objective, returnToStart) => {
        const routeStops = [start, ...stops, ...(returnToStart ? [start] : [])];
        setActiveRoute(null);
        const result = await routeApi.createPlan(routeStops, mode, objective);
        if ('error' in result) return result;
        setActiveRoute(result);
        setSelectedPlace(null);
        showToast('Đã tính tuyến qua các điểm bằng VietMap');
        return result;
      }} onSave={savePlan} />}
      {activePanel === 'traffic' && <TrafficReportPanel incidents={incidents} selectedPoint={selectedMapPoint} onClose={() => openPanel(null)} onReport={reportIncident} />}
      {activePanel === 'saved' && <SavedRoutesPanel routes={savedRoutes} onClose={() => openPanel(null)} onDelete={(id) => { setSavedRoutes((current) => current.filter((route) => route.id !== id)); showToast('Đã xóa hành trình đã lưu'); }} onOpen={(route) => { void openSavedRoute(route); }} />}
      {activePanel === 'ai' && <AiVisionPanel onClose={() => openPanel(null)} />}
      {activePanel === 'place' && selectedPlace && <PlacePanel place={selectedPlace} onClose={() => openPanel(null)} onDirections={openDirections} />}

      <MapToolbar
        layer={layer}
        onLayerChange={setLayer}
        onLocate={() => { void locateOnMap(); }}
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
