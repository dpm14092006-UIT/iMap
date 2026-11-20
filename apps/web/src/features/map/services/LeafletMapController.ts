import * as L from 'leaflet';
import type { LatLng } from '../../../shared/geo/types';
import type { Language } from '../../../shared/i18n/translate';
import type { Poi } from '../../explore/types';
import type { AlgorithmOverlay, RoutePlan } from '../../routing/types';
import type { TrafficMapLayer } from '../../traffic/domain/trafficMapLayer';
import type { DraftStops, MapLayer, MapOverlays } from '../types';
import { AlgorithmLayer } from './leaflet/AlgorithmLayer';
import { LifecycleCanvas } from './leaflet/LifecycleCanvas';
import { BaseLayers } from './leaflet/BaseLayers';
import { VIETNAM_CENTER } from './leaflet/drawing';
import { FocusPin } from './leaflet/FocusPin';
import { LocationLayer } from './leaflet/LocationLayer';
import { MapCamera, type FitInsets } from './leaflet/MapCamera';
import { PoiLayer } from './leaflet/PoiLayer';
import { RouteLayer } from './leaflet/RouteLayer';
import { TrafficLayers } from './leaflet/TrafficLayers';

type MapControllerHandlers = {
  onMapClick: (point: LatLng) => void;
  /** Bấm vào tuyến phụ hoặc nhãn tuyến trên bản đồ. */
  onSelectRoute?: (routeId: string) => void;
  onPoiClick?: (poiId: string) => void;
  onBoundsChange?: (bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => void;
};

/** Toàn bộ dữ liệu cần vẽ trên bản đồ, được MapView truyền vào mỗi khi thay đổi. */
type MapControllerData = {
  language: Language;
  layer: MapLayer;
  route: RoutePlan | null;
  routeOptions: RoutePlan[];
  draftStops: DraftStops;
  trafficLayer: TrafficMapLayer;
  currentLocation: LatLng | null;
  headingDegrees: number | null;
  isNavigating: boolean;
  isPicking: boolean;
  overlays: MapOverlays;
  pois: Poi[];
  highlightedPoiId: string | null;
};

/**
 * Facade bọc thư viện Leaflet: React chỉ gọi các method public của lớp này.
 * Mỗi loại dữ liệu trên bản đồ do một lớp riêng trong `./leaflet/` vẽ; lớp này quyết định KHI NÀO vẽ lại
 * (so với lần cập nhật trước) và giữ thứ tự chồng lớp.
 */
export class LeafletMapController {
  private language: Language = 'vi';
  private readonly map: L.Map;
  private readonly renderer = new LifecycleCanvas();
  private readonly base: BaseLayers;
  private readonly camera: MapCamera;
  private readonly routeLayer: RouteLayer;
  private readonly traffic: TrafficLayers;
  private readonly algorithms = new AlgorithmLayer();
  private readonly pois: PoiLayer;
  private readonly location = new LocationLayer();
  private readonly focus: FocusPin;

  private lastRouteId: string | null = null;
  private lastRouteOptionsKey = '';
  private lastRouteNavigationState: boolean | null = null;
  private lastCongestionVisible: boolean | null = null;
  private lastDraftStopsKey = '';
  private lastTrafficMapLayer: TrafficMapLayer | null = null;

  constructor(container: HTMLElement, handlers: MapControllerHandlers) {
    this.map = L.map(container, {
      zoomControl: false,
      preferCanvas: true,
      renderer: this.renderer,
      attributionControl: true,
    }).setView(VIETNAM_CENTER, 5);
    // Dock nằm đè góc trái nên ghi công và thước tỉ lệ đặt ở góc dưới phải.
    this.map.attributionControl.setPosition('bottomright');
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(this.map);

    const language = () => this.language;
    this.base = new BaseLayers(this.map);
    this.camera = new MapCamera(this.map);
    this.traffic = new TrafficLayers(this.map, language);
    this.routeLayer = new RouteLayer(this.map, language, handlers.onSelectRoute);
    this.pois = new PoiLayer(handlers.onPoiClick);
    this.focus = new FocusPin(this.map);

    // Thứ tự thêm = thứ tự chồng: nền → quầng giao thông → tuyến thuật toán → tuyến → nhãn → đoạn sự cố
    // trên tuyến → marker sự cố → POI → vị trí hiện tại.
    this.traffic.halo.addTo(this.map);
    this.algorithms.group.addTo(this.map);
    this.routeLayer.addRoutesTo(this.map);
    this.routeLayer.addLabelsTo(this.map);
    this.traffic.routeSections.addTo(this.map);
    this.traffic.markers.addTo(this.map);
    this.pois.group.addTo(this.map);
    this.location.group.addTo(this.map);

    this.map.on('moveend', () => handlers.onBoundsChange?.(this.camera.getBounds()));
    handlers.onBoundsChange?.(this.camera.getBounds());
    this.map.on('click', (event: L.LeafletMouseEvent) =>
      handlers.onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    );
  }

  /** Vẽ lại bản đồ theo dữ liệu mới nhất. */
  update(data: MapControllerData) {
    const languageChanged = data.language !== this.language;
    this.language = data.language;
    this.base.apply(data.layer, data.overlays.terrain);
    this.traffic.setVisibility(data.overlays);
    this.setPicking(data.isPicking);
    this.pois.update(data.pois, data.highlightedPoiId);

    const routeId = data.route?.id ?? null;
    const routeOptionsKey = data.routeOptions.map((route) => route.id).join('|');
    const draftStopsKey = [data.draftStops.origin, data.draftStops.destination]
      .map((place) => (place ? `${place.id}:${place.lat},${place.lng}:${place.name}` : ''))
      .join('|');
    const routeChanged =
      routeId !== this.lastRouteId ||
      routeOptionsKey !== this.lastRouteOptionsKey ||
      (routeId !== null && data.isNavigating !== this.lastRouteNavigationState) ||
      data.overlays.traffic !== this.lastCongestionVisible ||
      (!routeId && draftStopsKey !== this.lastDraftStopsKey);
    if (routeChanged) {
      this.routeLayer.clear();
      if (data.route)
        this.routeLayer.draw(data.route, data.routeOptions, data.isNavigating, data.overlays.traffic);
      else this.routeLayer.drawDraftStops(data.draftStops);
    }
    this.lastDraftStopsKey = draftStopsKey;
    this.focus.show(data.draftStops.focus ?? null);
    this.lastRouteNavigationState = data.isNavigating;
    this.lastCongestionVisible = data.overlays.traffic;

    if (languageChanged && !routeChanged && this.routeLayer.hasLabels()) this.routeLayer.redrawLabels();
    if (data.trafficLayer !== this.lastTrafficMapLayer || languageChanged)
      this.traffic.drawIncidents(data.trafficLayer);
    if (routeChanged || data.trafficLayer !== this.lastTrafficMapLayer)
      this.traffic.drawRouteSections(data.route, data.trafficLayer);
    this.lastTrafficMapLayer = data.trafficLayer;
    this.location.update(data.currentLocation, data.isNavigating, data.headingDegrees);

    // Chỉ tự zoom vừa tuyến khi có tuyến MỚI, tránh giật bản đồ mỗi lần render.
    if (data.route && (data.route.id !== this.lastRouteId || routeOptionsKey !== this.lastRouteOptionsKey)) {
      const routes =
        !data.isNavigating && data.route.kind === 'route' && data.routeOptions.length
          ? data.routeOptions
          : [data.route];
      const coordinates = routes.flatMap((route) => route.legs.flatMap((leg) => leg.points));
      if (coordinates.length) this.camera.fit(coordinates);
    }
    this.lastRouteId = routeId;
    this.lastRouteOptionsKey = routeOptionsKey;
  }

  showVietnam() {
    this.camera.showVietnam();
  }
  zoomIn() {
    this.camera.zoomIn();
  }
  zoomOut() {
    this.camera.zoomOut();
  }
  flyTo(point: LatLng, zoom = 15) {
    this.camera.flyTo(point, zoom);
  }
  followLocation(point: LatLng, zoom = 16) {
    this.camera.followLocation(point, zoom);
  }
  /** Xem MapCamera.onUserGesture. */
  onUserGesture(listener: () => void): () => void {
    return this.camera.onUserGesture(listener);
  }
  getZoom(): number {
    return this.camera.getZoom();
  }
  getCenter(): LatLng {
    return this.camera.getCenter();
  }
  /** Zoom vừa các điểm (vd. kết quả tìm quanh đây), chừa chỗ cho bảng đang mở. */
  fitPoints(points: LatLng[]) {
    if (points.length) this.camera.fit(points.map((point) => L.latLng(point.lat, point.lng)));
  }
  /** Zoom vừa khít một tuyến (nút "Xem trước"). */
  fitRoute(route: RoutePlan) {
    this.camera.fit(route.legs.flatMap((leg) => leg.points));
  }
  /** Vẽ tuyến Dijkstra / A* (null để xóa); tự zoom vừa khi có kết quả mới. */
  setAlgorithmOverlay(overlay: AlgorithmOverlay | null) {
    const points = this.algorithms.update(overlay);
    if (points) this.camera.fit(points);
  }
  /** Báo vùng bị bảng chức năng chiếm (trái ở desktop, đáy ở mobile); null khi không có bảng. */
  setFitInsets(insets: FitInsets | null) {
    this.camera.setFitInsets(insets);
  }
  /** Zoom lại vừa vùng vừa fit gần nhất (khi bảng đổi kích thước). */
  refit() {
    this.camera.refit();
  }
  invalidateSize() {
    this.map.invalidateSize({ pan: false });
  }
  destroy() {
    this.renderer.dispose();
    this.routeLayer.destroy();
    // Remove vector paths while their renderer is still alive. Map.remove() may otherwise
    // remove Canvas first, then schedule a path redraw after Canvas has deleted its context.
    const paths: L.Path[] = [];
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Path) paths.push(layer);
    });
    paths.forEach((layer) => layer.remove());
    this.map.remove();
  }

  /** Đổi con trỏ thành dấu "+" khi người dùng đang chọn điểm trên bản đồ. */
  private setPicking(isPicking: boolean) {
    this.map.getContainer().classList.toggle('is-picking', isPicking);
  }
}
