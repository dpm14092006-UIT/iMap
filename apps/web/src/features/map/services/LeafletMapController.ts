import * as L from 'leaflet';
import type { LatLng, Place } from '../../places/types';
import type { TrafficFeature, TrafficMapLayer, TrafficSeverity } from '../layers/trafficMapLayer';
import type { DraftStops, MapLayer, RoutePlan } from '../types';

/** Tâm mặc định: trung tâm TP.HCM. */
const HCMC_CENTER: L.LatLngExpression = [10.783, 106.704];
const COLORS = { start: '#20a26b', end: '#2476ea', route: '#2476ea', multiRoute: '#167dcb' };

export type MapControllerHandlers = {
  onSelectPlace: (place: Place) => void;
  onMapClick: (point: LatLng) => void;
};

/** Toàn bộ dữ liệu cần vẽ trên bản đồ, được MapView truyền vào mỗi khi thay đổi. */
export type MapControllerData = {
  layer: MapLayer;
  places: Place[];
  selectedPlaceId: string | null;
  route: RoutePlan | null;
  draftStops: DraftStops;
  trafficLayer: TrafficMapLayer;
  currentLocation: LatLng | null;
  isPicking: boolean;
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
  private readonly placesLayer = L.layerGroup();
  private readonly routeLayer = L.layerGroup();
  private readonly trafficLayer = L.layerGroup();
  private readonly locationLayer = L.layerGroup();
  private lastRouteId: string | null = null;
  private activeLayer: MapLayer = 'street';

  constructor(container: HTMLElement, private readonly handlers: MapControllerHandlers) {
    this.map = L.map(container, { zoomControl: false, preferCanvas: true, attributionControl: true }).setView(HCMC_CENTER, 13);
    this.map.attributionControl.setPosition('bottomleft');
    this.streets = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
    });
    this.imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    });
    this.streets.addTo(this.map);
    this.placesLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.trafficLayer.addTo(this.map);
    this.locationLayer.addTo(this.map);
    this.map.on('click', (event: L.LeafletMouseEvent) => handlers.onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }));
  }

  /** Vẽ lại bản đồ theo dữ liệu mới nhất. */
  update(data: MapControllerData) {
    this.setLayer(data.layer);
    this.setPicking(data.isPicking);

    this.placesLayer.clearLayers();
    for (const place of data.places) this.drawPlace(place, place.id === data.selectedPlaceId);

    this.routeLayer.clearLayers();
    if (data.route) this.drawRoute(data.route);
    else this.drawDraftStops(data.draftStops);

    this.drawTraffic(data.trafficLayer);
    this.drawCurrentLocation(data.currentLocation);

    // Chỉ tự zoom vừa tuyến khi có tuyến MỚI, tránh giật bản đồ mỗi lần render.
    if (data.route && data.route.id !== this.lastRouteId) {
      const coordinates = data.route.legs.flatMap((leg) => leg.points);
      if (coordinates.length) this.fit(coordinates);
    }
    this.lastRouteId = data.route?.id ?? null;
  }

  setLayer(layer: MapLayer) {
    if (this.activeLayer === layer && (layer === 'street' ? this.map.hasLayer(this.streets) : this.map.hasLayer(this.imagery))) return;
    this.activeLayer = layer;
    if (layer === 'satellite') {
      this.map.removeLayer(this.streets);
      this.imagery.addTo(this.map);
    } else {
      this.map.removeLayer(this.imagery);
      this.streets.addTo(this.map);
    }
  }

  zoomIn() { this.map.zoomIn(); }
  zoomOut() { this.map.zoomOut(); }
  flyTo(point: LatLng, zoom = 15) { this.map.flyTo([point.lat, point.lng], zoom, { duration: 0.55 }); }
  getCenter(): LatLng { const point = this.map.getCenter(); return { lat: point.lat, lng: point.lng }; }
  invalidateSize() { this.map.invalidateSize({ pan: false }); }
  destroy() { this.map.remove(); }

  /** Đổi con trỏ thành dấu "+" khi người dùng đang chọn điểm trên bản đồ. */
  private setPicking(isPicking: boolean) {
    this.map.getContainer().classList.toggle('is-picking', isPicking);
  }

  private drawPlace(place: Place, selected: boolean) {
    const marker = L.circleMarker([place.lat, place.lng], {
      radius: selected ? 8 : 5,
      color: '#ffffff',
      weight: selected ? 3 : 2,
      fillColor: selected ? '#2476ea' : '#547f68',
      fillOpacity: 1,
      bubblingMouseEvents: false,
    }).addTo(this.placesLayer);
    marker.bindTooltip(this.textElement('span', place.name), { direction: 'top', offset: [0, -5], className: 'routetwin-tooltip' });
    marker.on('click', () => this.handlers.onSelectPlace(place));
  }

  private drawRoute(route: RoutePlan) {
    for (const leg of route.legs) {
      const points = leg.points.map(([lat, lng]) => L.latLng(lat, lng));
      if (points.length < 2) continue;
      // Vẽ 2 lớp: viền trắng dày bên dưới + màu tuyến bên trên để nổi trên nền bản đồ.
      L.polyline(points, { color: '#fff', weight: 10, opacity: 0.94, lineCap: 'round', lineJoin: 'round' }).addTo(this.routeLayer);
      L.polyline(points, { color: route.kind === 'multi' ? COLORS.multiRoute : COLORS.route, weight: 5.5, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }).addTo(this.routeLayer);
    }
    route.stops.forEach((place, index) => {
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
    marker.bindTooltip(this.textElement('span', place.name), { direction: 'top', className: 'routetwin-tooltip' });
  }

  /** Vẽ sự cố giao thông theo hợp đồng TrafficMapLayer (bỏ qua sự cố đã thông thoáng). */
  private drawTraffic(layer: TrafficMapLayer) {
    this.trafficLayer.clearLayers();
    for (const feature of layer.features) {
      if (feature.properties.status !== 'active') continue;
      const [lng, lat] = feature.geometry.coordinates; // GeoJSON: [lng, lat]
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const marker = L.marker([lat, lng], { icon: this.trafficIcon(feature.properties.severity), keyboard: false }).addTo(this.trafficLayer);
      marker.bindPopup(this.trafficPopup(feature));
    }
  }

  private trafficPopup({ properties }: TrafficFeature): HTMLElement {
    const content = document.createElement('div');
    const status = properties.verified ? 'Đã xác minh' : 'Cảnh báo cộng đồng · chưa xác minh';
    const time = properties.reportedAt ? ` · ${new Date(properties.reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '';
    const detail = this.textElement('p', `${status}${time}`);
    detail.className = 'mb-0 mt-1 text-xs text-slate-500';
    content.append(this.textElement('strong', properties.title), detail);
    return content;
  }

  private drawCurrentLocation(point: LatLng | null) {
    this.locationLayer.clearLayers();
    if (!point) return;
    L.circleMarker([point.lat, point.lng], { radius: 8, fillColor: '#2476ea', fillOpacity: 1, color: '#fff', weight: 3 }).addTo(this.locationLayer);
  }

  private fit(points: L.LatLngExpression[]) {
    this.map.fitBounds(L.latLngBounds(points).pad(0.18), { padding: [70, 70], maxZoom: 15 });
  }

  private trafficIcon(severity: TrafficSeverity) {
    return L.divIcon({ className: `routetwin-incident-marker ${severity}`, html: '<span>!</span>', iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  /** Tạo element bằng textContent (không dùng innerHTML) để tránh chèn HTML từ dữ liệu người dùng. */
  private textElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
}
