import * as L from 'leaflet';
import type { LatLng, Place } from '../../places/types';
import type { TrafficFeature, TrafficMapLayer, TrafficSeverity } from '../layers/trafficMapLayer';
import type { AlgorithmOverlay, Bounds, DraftStops, MapLayer, RoutePlan } from '../types';

/** Khung nhìn khởi đầu toàn Việt Nam, không giới hạn pan/zoom vào một thành phố. */
const VIETNAM_CENTER: L.LatLngExpression = [16, 108];
const COLORS = {
  start: '#20a26b',
  end: '#2476ea',
  route: '#2476ea',
  multiRoute: '#167dcb',
  dijkstra: '#8b5cf6',
  astar: '#f97316',
  coverage: '#64748b',
};

export type MapControllerHandlers = {
  onMapClick: (point: LatLng) => void;
  onBoundsChange?: (bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => void;
};

/** Toàn bộ dữ liệu cần vẽ trên bản đồ, được MapView truyền vào mỗi khi thay đổi. */
export type MapControllerData = {
  layer: MapLayer;
  route: RoutePlan | null;
  draftStops: DraftStops;
  trafficLayer: TrafficMapLayer;
  currentLocation: LatLng | null;
  headingDegrees: number | null;
  isNavigating: boolean;
  isPicking: boolean;
  /** Tuyến Dijkstra/A* và khung vùng dữ liệu (null nếu chưa chạy thuật toán). */
  algorithmOverlay: AlgorithmOverlay | null;
};

/**
 * Lớp bao bọc thư viện Leaflet (Adapter).
 * React chỉ gọi các method public; mọi chi tiết Leaflet nằm trong class này.
 */
export class LeafletMapController {
  readonly map: L.Map;
  private readonly streets: L.TileLayer;
  private readonly imagery: L.TileLayer;
  // Mỗi loại dữ liệu một layer group riêng để xóa/vẽ lại độc lập.
  private readonly algorithmLayer = L.layerGroup();
  private readonly routeLayer = L.layerGroup();
  private readonly trafficLayer = L.layerGroup();
  private readonly locationLayer = L.layerGroup();
  private locationMarker: L.Marker | L.CircleMarker | null = null;
  private locationMarkerMode: 'passive' | 'navigation' | null = null;
  private lastRouteId: string | null = null;
  private lastRouteNavigationState: boolean | null = null;
  private lastDraftStopsKey = '';
  private lastOverlayKey: string | null = null;
  private lastTrafficMapLayer: TrafficMapLayer | null = null;
  private activeLayer: MapLayer = 'street';

  constructor(container: HTMLElement, handlers: MapControllerHandlers) {
    this.map = L.map(container, { zoomControl: false, preferCanvas: true, attributionControl: true }).setView(
      VIETNAM_CENTER,
      5,
    );
    this.map.attributionControl.setPosition('bottomleft');
    this.streets = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
    });
    this.imagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community',
      },
    );
    this.streets.addTo(this.map);
    this.algorithmLayer.addTo(this.map); // nằm dưới tuyến VietMap và marker
    this.routeLayer.addTo(this.map);
    this.trafficLayer.addTo(this.map);
    this.locationLayer.addTo(this.map);
    this.map.on('moveend', () => handlers.onBoundsChange?.(this.getBounds()));
    handlers.onBoundsChange?.(this.getBounds());
    this.map.on('click', (event: L.LeafletMouseEvent) =>
      handlers.onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    );
  }

  /** Vẽ lại bản đồ theo dữ liệu mới nhất. */
  update(data: MapControllerData) {
    this.setLayer(data.layer);
    this.setPicking(data.isPicking);

    const routeId = data.route?.id ?? null;
    const draftStopsKey = [data.draftStops.origin, data.draftStops.destination]
      .map((place) => (place ? `${place.id}:${place.lat},${place.lng}:${place.name}` : ''))
      .join('|');
    if (
      routeId !== this.lastRouteId ||
      (routeId !== null && data.isNavigating !== this.lastRouteNavigationState) ||
      (!routeId && draftStopsKey !== this.lastDraftStopsKey)
    ) {
      this.routeLayer.clearLayers();
      if (data.route) this.drawRoute(data.route, data.isNavigating);
      else this.drawDraftStops(data.draftStops);
    }
    this.lastDraftStopsKey = draftStopsKey;
    this.lastRouteNavigationState = data.isNavigating;

    if (data.algorithmOverlay?.key !== this.lastOverlayKey) this.drawAlgorithmOverlay(data.algorithmOverlay);
    if (data.trafficLayer !== this.lastTrafficMapLayer) this.drawTraffic(data.trafficLayer);
    this.lastTrafficMapLayer = data.trafficLayer;
    this.drawCurrentLocation(data.currentLocation, data.isNavigating, data.headingDegrees);

    // Chỉ tự zoom vừa tuyến khi có tuyến MỚI, tránh giật bản đồ mỗi lần render.
    if (data.route && data.route.id !== this.lastRouteId) {
      const coordinates = data.route.legs.flatMap((leg) => leg.points);
      if (coordinates.length) this.fit(coordinates);
    }
    this.lastRouteId = routeId;

    const overlay = data.algorithmOverlay;
    if (overlay && overlay.key !== this.lastOverlayKey) {
      const coordinates = overlay.paths.flatMap((path) => path.points);
      if (coordinates.length) this.fit(coordinates);
    }
    this.lastOverlayKey = overlay?.key ?? null;
  }

  /** 'dark' dùng chung tile OSM với 'street' nhưng thêm class CSS để đảo màu (xem styles.css). */
  setLayer(layer: MapLayer) {
    const expectedLayerIsVisible =
      layer === 'satellite' ? this.map.hasLayer(this.imagery) : this.map.hasLayer(this.streets);
    if (this.activeLayer === layer && expectedLayerIsVisible) {
      this.map.getContainer().classList.toggle('map-theme-dark', layer === 'dark');
      return;
    }
    this.activeLayer = layer;
    if (layer === 'satellite') {
      this.map.getContainer().classList.remove('map-theme-dark');
      this.map.removeLayer(this.streets);
      this.imagery.addTo(this.map);
    } else {
      this.map.removeLayer(this.imagery);
      this.streets.addTo(this.map);
      this.map.getContainer().classList.toggle('map-theme-dark', layer === 'dark');
    }
  }

  private getBounds() {
    const bounds = this.map.getBounds();
    return {
      minLat: Math.max(-90, bounds.getSouth()),
      maxLat: Math.min(90, bounds.getNorth()),
      minLng: Math.max(-180, bounds.getWest()),
      maxLng: Math.min(180, bounds.getEast()),
    };
  }
  showVietnam() {
    this.map.setView(VIETNAM_CENTER, 5);
  }
  zoomIn() {
    this.map.zoomIn();
  }
  zoomOut() {
    this.map.zoomOut();
  }
  flyTo(point: LatLng, zoom = 15) {
    this.map.flyTo([point.lat, point.lng], zoom, { duration: 0.55 });
  }
  followLocation(point: LatLng, zoom = 16) {
    const target = L.latLng(point.lat, point.lng);
    if (this.map.getZoom() < zoom) this.map.setView(target, zoom, { animate: true, duration: 0.35 });
    else if (this.map.getCenter().distanceTo(target) > 25)
      this.map.panTo(target, { animate: true, duration: 0.35 });
  }
  getCenter(): LatLng {
    const point = this.map.getCenter();
    return { lat: point.lat, lng: point.lng };
  }
  invalidateSize() {
    this.map.invalidateSize({ pan: false });
  }
  destroy() {
    this.map.remove();
  }

  /** Đổi con trỏ thành dấu "+" khi người dùng đang chọn điểm trên bản đồ. */
  private setPicking(isPicking: boolean) {
    this.map.getContainer().classList.toggle('is-picking', isPicking);
  }

  private drawRoute(route: RoutePlan, isNavigating: boolean) {
    for (const leg of route.legs) {
      const points = leg.points.map(([lat, lng]) => L.latLng(lat, lng));
      if (points.length < 2) continue;
      // Vẽ 2 lớp: viền trắng dày bên dưới + màu tuyến bên trên để nổi trên nền bản đồ.
      L.polyline(points, {
        color: '#fff',
        weight: 10,
        opacity: 0.94,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(this.routeLayer);
      L.polyline(points, {
        color: route.kind === 'multi' ? COLORS.multiRoute : COLORS.route,
        weight: 5.5,
        opacity: 0.98,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(this.routeLayer);
    }
    route.stops.forEach((place, index) => {
      if (isNavigating && index === 0) return;
      const isLast = index === route.stops.length - 1;
      // Tuyến 1 chặng dùng nhãn A/B, nhiều điểm dùng số thứ tự.
      const label = index === 0 ? 'A' : route.kind === 'route' ? 'B' : String(index);
      this.drawStopMarker(place, label, route.kind === 'route' && isLast ? COLORS.end : COLORS.start);
    });
  }

  /** Marker A/B cho điểm đi/đến đã chọn nhưng chưa tính tuyến. */
  private drawDraftStops({ origin, destination }: DraftStops) {
    if (origin) this.drawStopMarker(origin, 'A', COLORS.start);
    if (destination) this.drawStopMarker(destination, 'B', COLORS.end);
  }

  private drawStopMarker(place: Place, label: string, color: string) {
    const icon = L.divIcon({
      className: 'routetwin-route-marker',
      html: `<span style="--marker-color:${color}">${label}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const marker = L.marker([place.lat, place.lng], { icon, keyboard: false }).addTo(this.routeLayer);
    marker.bindTooltip(this.textElement('span', place.name), {
      direction: 'top',
      className: 'routetwin-tooltip',
    });
  }

  /**
   * Vẽ kết quả thuật toán: Dijkstra nét liền tím (dày, bên dưới), A* nét đứt cam (bên trên).
   * Hai tuyến thường trùng nhau vì cùng chi phí tối ưu, nên vẫn thấy được cả hai màu.
   */
  private drawAlgorithmOverlay(overlay: AlgorithmOverlay | null) {
    this.algorithmLayer.clearLayers();
    if (!overlay) return;
    if (overlay.coverage) this.drawCoverage(overlay.coverage);
    for (const path of overlay.paths) {
      if (path.points.length < 2) continue;
      const style: L.PolylineOptions =
        path.algorithm === 'dijkstra'
          ? { color: COLORS.dijkstra, weight: 8, opacity: 0.55 }
          : { color: COLORS.astar, weight: 4, opacity: 0.95, dashArray: '8 7' };
      L.polyline(path.points, { ...style, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(
        this.algorithmLayer,
      );
    }
  }

  /** Khung nét đứt cho biết vùng có dữ liệu đồ thị OSM. */
  private drawCoverage({ south, west, north, east }: Bounds) {
    L.rectangle(
      [
        [south, west],
        [north, east],
      ],
      {
        color: COLORS.coverage,
        weight: 1.5,
        dashArray: '6 6',
        fill: false,
        interactive: false,
      },
    ).addTo(this.algorithmLayer);
  }

  /** Vẽ sự cố giao thông theo hợp đồng TrafficMapLayer (bỏ qua sự cố đã thông thoáng). */
  private drawTraffic(layer: TrafficMapLayer) {
    this.trafficLayer.clearLayers();
    for (const feature of layer.features) {
      if (feature.properties.status !== 'active') continue;
      const [lng, lat] = feature.geometry.coordinates; // GeoJSON: [lng, lat]
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const { severity, communityReporterCount = 0 } = feature.properties;
      const marker = L.marker([lat, lng], {
        icon: this.trafficIcon(severity, communityReporterCount),
        keyboard: false,
      }).addTo(this.trafficLayer);
      marker.bindPopup(this.trafficPopup(feature));
    }
  }

  /** Popup sự cố: tiêu đề + số báo cáo được gộp và số người xác nhận (dữ liệu cộng đồng từ N2). */
  private trafficPopup({ properties }: TrafficFeature): HTMLElement {
    const content = document.createElement('div');
    const formatTime = (iso: string) =>
      new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const reportCount = properties.communityReportCount ?? 1;
    const reporterCount = properties.communityReporterCount ?? 0;
    const freshness = properties.communityUpdatedAt
      ? ` · cập nhật ${formatTime(properties.communityUpdatedAt)}`
      : ' · chưa có xác nhận mới';
    const detail = this.textElement(
      'p',
      `${reportCount} báo cáo / 75 m trong 30 phút từ ${reporterCount} người${freshness}`,
    );
    detail.className = 'mb-0 mt-1 text-xs text-slate-500';
    content.append(this.textElement('strong', properties.title), detail);
    return content;
  }

  private drawCurrentLocation(point: LatLng | null, isNavigating: boolean, headingDegrees: number | null) {
    if (!point) {
      this.locationLayer.clearLayers();
      this.locationMarker = null;
      this.locationMarkerMode = null;
      return;
    }

    const mode = isNavigating ? 'navigation' : 'passive';
    if (!this.locationMarker || this.locationMarkerMode !== mode) {
      this.locationLayer.clearLayers();
      this.locationMarker =
        mode === 'navigation'
          ? L.marker([point.lat, point.lng], {
              icon: this.navigationIcon(),
              keyboard: false,
              interactive: false,
              zIndexOffset: 1000,
            }).addTo(this.locationLayer)
          : L.circleMarker([point.lat, point.lng], {
              radius: 8,
              fillColor: '#2476ea',
              fillOpacity: 1,
              color: '#fff',
              weight: 3,
            }).addTo(this.locationLayer);
      this.locationMarkerMode = mode;
    }

    this.locationMarker.setLatLng([point.lat, point.lng]);
    if (mode === 'navigation') {
      const element = this.locationMarker.getElement();
      if (element instanceof HTMLElement || element instanceof SVGElement) {
        element.style.setProperty('--heading-degrees', `${headingDegrees ?? 0}deg`);
      }
    }
  }

  private navigationIcon() {
    return L.divIcon({
      className: 'routetwin-navigation-marker',
      html: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 43 43 24 34 5 43Z" /></svg>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }

  private fit(points: L.LatLngExpression[]) {
    this.map.fitBounds(L.latLngBounds(points).pad(0.18), { padding: [70, 70], maxZoom: 15 });
  }

  /** Marker sự cố: màu theo mức độ; hiện số người xác nhận khi có từ 2 người trở lên, nếu không thì "!". */
  private trafficIcon(severity: TrafficSeverity, communityReporterCount: number) {
    const label = communityReporterCount > 1 ? String(communityReporterCount) : '!';
    return L.divIcon({
      className: `routetwin-incident-marker ${severity}`,
      html: `<span>${label}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  /** Tạo element bằng textContent (không dùng innerHTML) để tránh chèn HTML từ dữ liệu người dùng. */
  private textElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
}
