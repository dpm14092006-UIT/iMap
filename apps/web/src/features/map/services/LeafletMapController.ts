import * as L from 'leaflet';
import { iconSvg } from '../../../shared/components/Icon';
import { translate, type Language } from '../../../shared/i18n/I18nProvider';
import { poiMetaFor } from '../../explore/data/poiCatalog';
import type { Poi } from '../../explore/types';
import {
  formatDistanceKm,
  formatDurationCompact,
  formatDurationMinutes,
} from '../../navigation/utils/format';
import { minutesSlowerThanFastest, routeLabels } from '../../navigation/utils/routeLabels';
import type { LatLng, Place } from '../../places/types';
import type { TrafficFeature, TrafficMapLayer, TrafficSeverity } from '../layers/trafficMapLayer';
import type { AlgorithmOverlay, Coordinate, DraftStops, MapLayer, MapOverlays, RoutePlan } from '../types';
import {
  CONGESTION_COLORS,
  CONGESTION_LABELS,
  CONGESTION_RANK,
  splitRouteByCongestion,
  worstCongestionLevel,
} from '../../traffic/services/routeCongestion';
import { routeHazardSection } from '../../traffic/services/routeTraffic';
import { pickRouteLabelPoints } from './routeLabelPlacement';

/** Khung nhìn khởi đầu toàn Việt Nam, không giới hạn pan/zoom vào một thành phố. */
const VIETNAM_CENTER: L.LatLngExpression = [16, 108];
const COLORS = {
  start: '#0d9488',
  end: '#4338ca',
  routeFrom: [0x43, 0x38, 0xca],
  routeTo: [0x0d, 0x94, 0x88],
  alternative: '#a5b4fc',
};
/** Mức sự cố → màu giao thông (cùng bảng màu với chú giải: vàng / đỏ / đỏ sẫm). */
const SEVERITY_COLORS: Record<TrafficSeverity, string> = {
  low: '#facc15',
  medium: '#ef4444',
  high: '#991b1b',
};
const HALO_RADIUS_METERS: Record<TrafficSeverity, number> = { low: 200, medium: 280, high: 360 };
/** Số đoạn dùng để mô phỏng dải màu gradient dọc theo tuyến (Leaflet không hỗ trợ gradient). */
const GRADIENT_SEGMENTS = 28;
/** Nét bo tròn hai đầu và chỗ gấp, dùng cho mọi đường vẽ trên bản đồ. */
const ROUND = { lineCap: 'round', lineJoin: 'round' } as const;
const toLatLngs = (points: Coordinate[]) => points.map(([lat, lng]) => L.latLng(lat, lng));
/** Dưới ngưỡng này (px) là điện thoại: nhãn tuyến rút gọn, chừa chỗ cho bảng kéo ở đáy. */
const MOBILE_QUERY = '(max-width: 767px)';
/** Vùng bản đồ bị giao diện nổi che (px, tính từ mép khung bản đồ). */
type FitInsets = { left: number; bottom: number };

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
 * Lớp bao bọc thư viện Leaflet (Adapter).
 * React chỉ gọi các method public; mọi chi tiết Leaflet nằm trong class này.
 */
export class LeafletMapController {
  private language: Language = 'vi';
  private readonly map: L.Map;
  private readonly streets: L.TileLayer;
  private readonly imagery: L.TileLayer;
  private readonly terrain: L.TileLayer;
  // Mỗi loại dữ liệu một layer group riêng để xóa/vẽ lại độc lập.
  private readonly routeLayer = L.layerGroup();
  /** Tuyến Dijkstra/A* và khung vùng dữ liệu OSM (chế độ thuyết trình ?demo=1). */
  private readonly algorithmLayer = L.layerGroup();
  private lastAlgorithmKey: string | null = null;
  private readonly labelLayer = L.layerGroup();
  private readonly routeTrafficLayer = L.layerGroup();
  private readonly trafficHaloLayer = L.layerGroup();
  private readonly trafficLayer = L.layerGroup();
  private readonly poiLayer = L.layerGroup();
  private readonly poiMarkers = new Map<string, L.Marker>();
  private lastPois: Poi[] | null = null;
  private readonly locationLayer = L.layerGroup();
  private locationMarker: L.Marker | L.CircleMarker | null = null;
  private locationMarkerMode: 'passive' | 'navigation' | null = null;
  private lastRouteId: string | null = null;
  private lastFitPoints: L.LatLngExpression[] | null = null;
  private fitInsets: FitInsets | null = null;
  private lastLabels: { routes: RoutePlan[]; selected: RoutePlan } | null = null;
  private readonly mobileQuery = window.matchMedia(MOBILE_QUERY);
  private readonly onMobileChange = () => {
    if (this.lastLabels) this.drawRouteLabels(this.lastLabels.routes, this.lastLabels.selected);
  };
  private lastRouteOptionsKey = '';
  private lastRouteNavigationState: boolean | null = null;
  private lastCongestionVisible: boolean | null = null;
  private lastDraftStopsKey = '';
  private focusMarker: L.Marker | null = null;
  private lastFocusKey = '';
  private lastTrafficMapLayer: TrafficMapLayer | null = null;

  constructor(
    container: HTMLElement,
    private readonly handlers: MapControllerHandlers,
  ) {
    this.map = L.map(container, { zoomControl: false, preferCanvas: true, attributionControl: true }).setView(
      VIETNAM_CENTER,
      5,
    );
    // Dock nằm đè góc trái nên ghi công và thước tỉ lệ đặt ở góc dưới phải.
    this.map.attributionControl.setPosition('bottomright');
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(this.map);
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
    this.terrain = L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution:
        '<a href="https://opentopomap.org" target="_blank" rel="noreferrer">© OpenTopoMap (CC-BY-SA)</a>',
    });
    this.streets.addTo(this.map);
    this.trafficHaloLayer.addTo(this.map); // quầng giao thông nằm dưới tuyến
    this.algorithmLayer.addTo(this.map); // tuyến thuật toán nằm dưới tuyến VietMap
    this.routeLayer.addTo(this.map);
    this.labelLayer.addTo(this.map);
    this.mobileQuery.addEventListener('change', this.onMobileChange);
    this.routeTrafficLayer.addTo(this.map);
    this.trafficLayer.addTo(this.map);
    this.poiLayer.addTo(this.map);
    this.locationLayer.addTo(this.map);
    this.map.on('moveend', () => handlers.onBoundsChange?.(this.getBounds()));
    this.map.on('zoomend', () => this.separateRouteLabels());
    handlers.onBoundsChange?.(this.getBounds());
    this.map.on('click', (event: L.LeafletMouseEvent) =>
      handlers.onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    );
  }

  /** Vẽ lại bản đồ theo dữ liệu mới nhất. */
  update(data: MapControllerData) {
    const languageChanged = data.language !== this.language;
    this.language = data.language;
    this.applyBase(data.layer, data.overlays.terrain);
    this.setOverlayVisibility(data.overlays);
    this.setPicking(data.isPicking);
    this.setPoiMarkers(data.pois, data.highlightedPoiId);

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
      this.routeLayer.clearLayers();
      this.labelLayer.clearLayers();
      this.lastLabels = null;
      if (data.route) {
        const showOptions = !data.isNavigating && data.route.kind === 'route';
        if (showOptions) this.drawAlternativeRoutes(data.routeOptions, data.route.id, data.overlays.traffic);
        this.drawRoute(data.route, data.isNavigating, data.overlays.traffic);
        if (showOptions) this.drawRouteLabels(data.routeOptions, data.route);
      } else this.drawDraftStops(data.draftStops);
    }
    this.lastDraftStopsKey = draftStopsKey;
    this.drawFocus(data.draftStops.focus ?? null);
    this.lastRouteNavigationState = data.isNavigating;
    this.lastCongestionVisible = data.overlays.traffic;

    if (languageChanged && !routeChanged && this.lastLabels)
      this.drawRouteLabels(this.lastLabels.routes, this.lastLabels.selected);
    if (data.trafficLayer !== this.lastTrafficMapLayer || languageChanged)
      this.drawTraffic(data.trafficLayer);
    if (routeChanged || data.trafficLayer !== this.lastTrafficMapLayer)
      this.drawRouteTraffic(data.route, data.trafficLayer);
    this.lastTrafficMapLayer = data.trafficLayer;
    this.drawCurrentLocation(data.currentLocation, data.isNavigating, data.headingDegrees);

    // Chỉ tự zoom vừa tuyến khi có tuyến MỚI, tránh giật bản đồ mỗi lần render.
    if (data.route && (data.route.id !== this.lastRouteId || routeOptionsKey !== this.lastRouteOptionsKey)) {
      const routes = !data.isNavigating && data.route.kind === 'route' ? data.routeOptions : [data.route];
      const coordinates = routes.flatMap((route) => route.legs.flatMap((leg) => leg.points));
      if (coordinates.length) this.fit(coordinates);
    }
    this.lastRouteId = routeId;
    this.lastRouteOptionsKey = routeOptionsKey;
  }

  /**
   * Chọn nền: vệ tinh, địa hình (lớp phủ) hoặc đường phố. 'dark' dùng chung tile OSM với 'street'
   * nhưng thêm class CSS để đảo màu (xem styles.css).
   */
  private applyBase(layer: MapLayer, terrain: boolean) {
    const base = layer === 'satellite' ? this.imagery : terrain ? this.terrain : this.streets;
    for (const candidate of [this.streets, this.imagery, this.terrain]) {
      if (candidate !== base && this.map.hasLayer(candidate)) this.map.removeLayer(candidate);
    }
    if (!this.map.hasLayer(base)) base.addTo(this.map);
    this.map.getContainer().classList.toggle('map-theme-dark', layer === 'dark');
  }

  /** Bật/tắt quầng giao thông + màu đoạn tắc trên tuyến (traffic) và marker sự cố (incidents). */
  private setOverlayVisibility({ traffic, incidents }: MapOverlays) {
    this.toggleGroup(this.trafficHaloLayer, traffic);
    this.toggleGroup(this.routeTrafficLayer, traffic);
    this.toggleGroup(this.trafficLayer, incidents);
  }

  private toggleGroup(group: L.LayerGroup, visible: boolean) {
    const present = this.map.hasLayer(group);
    if (visible && !present) group.addTo(this.map);
    else if (!visible && present) group.remove();
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
    this.map.flyTo(this.centerAboveSheet(L.latLng(point.lat, point.lng), zoom), zoom, { duration: 0.55 });
  }
  /** Điện thoại: bảng/banner che đáy nên dời tâm xuống để điểm nằm giữa phần bản đồ còn thấy. */
  private centerAboveSheet(target: L.LatLng, zoom: number): L.LatLng {
    const covered = this.mobileQuery.matches ? (this.fitInsets?.bottom ?? 0) : 0;
    if (covered <= 0) return target;
    return this.map.unproject(this.map.project(target, zoom).add([0, covered / 2]), zoom);
  }
  followLocation(point: LatLng, zoom = 16) {
    const target = this.centerAboveSheet(L.latLng(point.lat, point.lng), Math.max(this.map.getZoom(), zoom));
    if (this.map.getZoom() < zoom) this.map.setView(target, zoom, { animate: true, duration: 0.35 });
    else if (this.map.getCenter().distanceTo(target) > 25)
      this.map.panTo(target, { animate: true, duration: 0.35 });
  }
  /**
   * Gọi `listener` khi người dùng tự kéo / zoom bản đồ (kéo, cuộn chuột, chụm 2 ngón, chạm đúp).
   * Dùng để tạm ngừng bám vị trí lúc dẫn đường cho người dùng xem trước hành trình.
   */
  onUserGesture(listener: () => void): () => void {
    const container = this.map.getContainer();
    const onTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) listener();
    };
    this.map.on('dragstart dblclick', listener);
    container.addEventListener('wheel', listener, { passive: true });
    container.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      this.map.off('dragstart dblclick', listener);
      container.removeEventListener('wheel', listener);
      container.removeEventListener('touchstart', onTouch);
    };
  }
  getZoom(): number {
    return this.map.getZoom();
  }
  /** Zoom vừa các điểm (vd. kết quả tìm quanh đây), chừa chỗ cho bảng đang mở. */
  fitPoints(points: LatLng[]) {
    if (points.length) this.fit(points.map((point) => L.latLng(point.lat, point.lng)));
  }
  /**
   * Vẽ kết quả Dijkstra / A*: Dijkstra nét liền tím (dày, bên dưới), A* nét đứt cam (bên trên),
   * khung nét đứt xám là vùng có dữ liệu đồ thị. Hai tuyến thường trùng nhau vì cùng chi phí tối ưu.
   * Tự zoom vừa tuyến khi có kết quả mới. null để xóa.
   */
  setAlgorithmOverlay(overlay: AlgorithmOverlay | null) {
    this.algorithmLayer.clearLayers();
    if (overlay?.coverage) {
      const { south, west, north, east } = overlay.coverage;
      L.rectangle(
        [
          [south, west],
          [north, east],
        ],
        { color: '#64748b', weight: 1.5, dashArray: '6 6', fill: false, interactive: false },
      ).addTo(this.algorithmLayer);
    }
    for (const path of overlay?.paths ?? []) {
      if (path.points.length < 2) continue;
      const style: L.PolylineOptions =
        path.algorithm === 'dijkstra'
          ? { color: '#8b5cf6', weight: 8, opacity: 0.55 }
          : { color: '#f97316', weight: 4, opacity: 0.95, dashArray: '8 7' };
      L.polyline(path.points, { ...style, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(
        this.algorithmLayer,
      );
    }
    const points = overlay?.paths.flatMap((path) => path.points) ?? [];
    if (overlay && overlay.key !== this.lastAlgorithmKey && points.length) this.fit(points);
    this.lastAlgorithmKey = overlay?.key ?? null;
  }

  /** Zoom vừa khít một tuyến (nút "Xem trước"). */
  fitRoute(route: RoutePlan) {
    this.fit(route.legs.flatMap((leg) => leg.points));
  }
  /** Báo vùng bị bảng chức năng chiếm (trái ở desktop, đáy ở mobile); null khi không có bảng. */
  setFitInsets(insets: FitInsets | null) {
    this.fitInsets = insets;
  }
  /** Zoom lại vừa vùng vừa fit gần nhất (khi bảng đổi kích thước). */
  refit() {
    if (this.lastFitPoints) this.fit(this.lastFitPoints);
  }
  getCenter(): LatLng {
    const point = this.map.getCenter();
    return { lat: point.lat, lng: point.lng };
  }
  invalidateSize() {
    this.map.invalidateSize({ pan: false });
  }
  destroy() {
    this.mobileQuery.removeEventListener('change', this.onMobileChange);
    this.map.remove();
  }

  /** Đổi con trỏ thành dấu "+" khi người dùng đang chọn điểm trên bản đồ. */
  private setPicking(isPicking: boolean) {
    this.map.getContainer().classList.toggle('is-picking', isPicking);
  }

  private drawRoute(route: RoutePlan, isNavigating: boolean, showCongestion = false) {
    const congestion = showCongestion && route.congestion?.segments.length ? route.congestion : null;
    for (const leg of route.legs) {
      const points = toLatLngs(leg.points);
      if (points.length < 2) continue;
      if (congestion && route.legs.length === 1) {
        this.drawCongestionLine(leg.points, congestion.segments);
        continue;
      }
      this.drawWhiteCasing(points, this.routeLayer);
      this.drawGradientLine(points);
    }
    route.stops.forEach((place, index) => {
      if (isNavigating && index === 0) return;
      const isLast = index === route.stops.length - 1;
      // Tuyến 1 chặng dùng nhãn A/B, nhiều điểm dùng số thứ tự.
      const label = index === 0 ? 'A' : route.kind === 'route' ? 'B' : String(index);
      this.drawStopMarker(place, label, route.kind === 'route' && isLast ? COLORS.end : COLORS.start);
    });
  }

  /** Viền trắng dày bên dưới để tuyến (hoặc đoạn sự cố) nổi trên mọi nền bản đồ. */
  private drawWhiteCasing(points: L.LatLngExpression[], layer: L.LayerGroup) {
    L.polyline(points, { ...ROUND, color: '#fff', weight: 10, opacity: 0.94, interactive: false }).addTo(
      layer,
    );
  }

  /**
   * Tuyến chọn kiểu Google Maps: viền tối bên dưới, mỗi đoạn tô theo mức ùn tắc VietMap.
   * Đoạn 'unknown' giữ dải màu thương hiệu của tuyến thường.
   */
  private drawCongestionLine(
    coordinates: Coordinate[],
    segments: NonNullable<RoutePlan['congestion']>['segments'],
  ) {
    const parts = splitRouteByCongestion(coordinates, segments);
    const casing = { ...ROUND, interactive: false } as const;
    L.polyline(toLatLngs(coordinates), { ...casing, color: '#1e293b', weight: 10.5, opacity: 0.92 }).addTo(
      this.routeLayer,
    );
    // Mức nặng vẽ sau cùng để không bị đoạn thoáng liền kề che chỗ nối.
    [...parts]
      .sort((a, b) => CONGESTION_RANK[a.level] - CONGESTION_RANK[b.level])
      .forEach(({ level, points }) => {
        const latLngs = toLatLngs(points);
        const color = CONGESTION_COLORS[level];
        if (color) L.polyline(latLngs, { ...casing, color, weight: 6, opacity: 1 }).addTo(this.routeLayer);
        else this.drawGradientLine(latLngs);
      });
  }

  /** Tô tuyến chọn bằng dải màu indigo → teal: chia thành nhiều đoạn, mỗi đoạn một màu nội suy. */
  private drawGradientLine(points: L.LatLng[]) {
    const segments = Math.min(GRADIENT_SEGMENTS, points.length - 1);
    for (let index = 0; index < segments; index++) {
      const from = Math.floor((index * (points.length - 1)) / segments);
      const to = Math.floor(((index + 1) * (points.length - 1)) / segments);
      const ratio = (index + 0.5) / segments;
      const color = COLORS.routeFrom.map((start, channel) =>
        Math.round(start + (COLORS.routeTo[channel]! - start) * ratio),
      );
      L.polyline(points.slice(from, to + 1), {
        ...ROUND,
        color: `rgb(${color.join(',')})`,
        weight: 5.5,
        opacity: 1,
        interactive: false,
      }).addTo(this.routeLayer);
    }
  }

  /** Vẽ các phương án không được chọn thành nét xám-tím nhạt; bấm vào để chọn tuyến đó. */
  private drawAlternativeRoutes(routes: RoutePlan[], selectedId: string, showCongestion = false) {
    for (const route of routes) {
      if (route.id === selectedId) continue;
      for (const leg of route.legs) {
        const points = toLatLngs(leg.points);
        if (points.length < 2) continue;
        // Viền xám đậm giúp nét phụ nổi trên cả nền sáng lẫn nền tối.
        L.polyline(points, {
          ...ROUND,
          color: '#475569',
          weight: 9,
          opacity: 0.55,
          interactive: false,
        }).addTo(this.routeLayer);
        L.polyline(points, { ...ROUND, color: COLORS.alternative, weight: 5.5, opacity: 0.95 })
          .on('click', (event) => {
            L.DomEvent.stopPropagation(event);
            this.handlers.onSelectRoute?.(route.id);
          })
          .addTo(this.routeLayer);
        // Lớp mảnh theo mức ùn tắc nằm trên nét xám-tím; không tương tác nên bấm vẫn chọn tuyến.
        if (showCongestion && route.congestion?.segments.length && route.legs.length === 1) {
          for (const part of splitRouteByCongestion(leg.points, route.congestion.segments)) {
            const color = CONGESTION_COLORS[part.level];
            if (!color) continue;
            L.polyline(toLatLngs(part.points), {
              ...ROUND,
              color,
              weight: 2.5,
              opacity: 1,
              interactive: false,
            }).addTo(this.routeLayer);
          }
        }
      }
    }
  }

  /**
   * Nhãn thời gian giữa mỗi tuyến: tuyến chọn nền gradient, tuyến phụ nền trắng. Mỗi nhãn nằm ở điểm
   * xa các tuyến khác nhất. Điện thoại chỉ hiện thời gian + chấm ùn tắc.
   */
  private drawRouteLabels(routes: RoutePlan[], selected: RoutePlan) {
    this.labelLayer.clearLayers();
    this.lastLabels = { routes, selected };
    const all = routes.some((route) => route.id === selected.id) ? routes : [selected, ...routes];
    const compact = this.mobileQuery.matches;
    const paths = all.map((route): Coordinate[] => route.legs.flatMap((leg) => leg.points));
    const points = pickRouteLabelPoints(paths);
    all.forEach((route, index) => {
      if (paths[index]!.length < 2) return;
      const isSelected = route.id === selected.id;
      const text = `${formatDurationMinutes(route.durationMin, this.language)} · ${formatDistanceKm(route.distanceKm, this.language)}`;
      const labels = routeLabels(route, all).map((label) => translate(this.language, label));
      const delta = minutesSlowerThanFastest(route, all);
      const hint = [
        ...labels,
        ...(delta >= 1 ? [translate(this.language, '+{minutes} phút', { minutes: delta })] : []),
      ].join(' · ');
      const title = hint ? `${text} (${hint})` : text;
      const worst = worstCongestionLevel(route.congestion);
      const worstColor = worst ? CONGESTION_COLORS[worst] : null;
      const dot = worstColor
        ? `<i class='routetwin-route-dot' style='background:${worstColor}' title='${translate(this.language, CONGESTION_LABELS[worst!])}' aria-hidden='true'></i>`
        : '';
      const body = compact
        ? `${dot}<span>${formatDurationCompact(route.durationMin, this.language)}</span>`
        : `${iconSvg(route.vehicle === 'car' ? 'car' : 'motorcycle', 14)}${dot}<span>${text}</span>${hint ? `<small>${hint}</small>` : ''}`;
      const icon = L.divIcon({
        className: 'routetwin-route-label-wrap',
        html: `<button type='button' class='routetwin-route-label${compact ? ' is-compact' : ''}${isSelected ? ' is-selected' : ''}' aria-label='${translate(this.language, 'Chọn tuyến {route}', { route: title })}' title='${title}'>${body}</button>`,
        iconSize: [0, 0],
      });
      const [lat, lng] = points[index]!;
      L.marker([lat, lng], { icon, keyboard: false, zIndexOffset: isSelected ? 600 : 400 })
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          this.handlers.onSelectRoute?.(route.id);
        })
        .addTo(this.labelLayer);
    });
    this.separateRouteLabels();
  }

  /**
   * Nhãn của các tuyến gần nhau (cùng xuất phát, nhập lại đoạn chung) dễ chồng lên nhau ở mức zoom
   * nhỏ: đo nhãn trên màn hình, nhãn tuyến đang chọn giữ chỗ, các nhãn còn lại dời lên/xuống tới chỗ trống.
   */
  private separateRouteLabels() {
    const labels = [...this.map.getContainer().querySelectorAll<HTMLElement>('.routetwin-route-label')];
    labels.sort(
      (a, b) => Number(b.classList.contains('is-selected')) - Number(a.classList.contains('is-selected')),
    );
    labels.forEach((label) => label.style.setProperty('--dy', '0px'));
    const placed: DOMRect[] = [];
    const overlaps = (a: DOMRect, b: DOMRect, dy: number) =>
      a.left < b.right + 4 && a.right > b.left - 4 && a.top + dy < b.bottom + 3 && a.bottom + dy > b.top - 3;
    for (const label of labels) {
      const rect = label.getBoundingClientRect();
      const step = rect.height + 6;
      const dy = [0, 1, -1, 2, -2, 3, -3]
        .map((n) => n * step)
        .find((offset) => !placed.some((other) => overlaps(rect, other, offset)));
      const shift = dy ?? 0;
      label.style.setProperty('--dy', `${shift}px`);
      placed.push(new DOMRect(rect.x, rect.y + shift, rect.width, rect.height));
    }
  }

  /** Tô riêng đoạn có sự cố để mức vừa/cao hiện lần lượt vàng/đỏ trên tuyến màu xanh. */
  private drawRouteTraffic(route: RoutePlan | null, traffic: TrafficMapLayer) {
    this.routeTrafficLayer.clearLayers();
    if (!route) return;
    const severityRank: Record<TrafficSeverity, number> = { low: 0, medium: 1, high: 2 };
    const reports = [...traffic.features]
      .filter((feature) => feature.properties.status === 'active')
      .sort((a, b) => severityRank[a.properties.severity] - severityRank[b.properties.severity]);

    for (const feature of reports) {
      const [lng, lat] = feature.geometry.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const section = routeHazardSection(route, { lat, lng });
      if (!section || section.distanceMeters > 180 || section.points.length < 2) continue;
      this.drawWhiteCasing(section.points, this.routeTrafficLayer);
      L.polyline(section.points, {
        ...ROUND,
        color: SEVERITY_COLORS[feature.properties.severity],
        weight: 5.5,
        opacity: 1,
        interactive: false,
      }).addTo(this.routeTrafficLayer);
    }
  }

  /** Ghim giọt nước cho địa điểm đang xem chi tiết; chỉ vẽ lại khi đổi địa điểm. */
  private drawFocus(place: Place | null) {
    const key = place ? `${place.lat},${place.lng}` : '';
    if (key === this.lastFocusKey) return;
    this.lastFocusKey = key;
    this.focusMarker?.remove();
    this.focusMarker = null;
    if (!place) return;
    const icon = L.divIcon({
      className: 'routetwin-focus-marker',
      html: '<span></span>',
      iconSize: [30, 40],
      iconAnchor: [15, 38],
    });
    this.focusMarker = L.marker([place.lat, place.lng], { icon, keyboard: false, zIndexOffset: 900 })
      .bindTooltip(this.textElement('span', place.name), {
        direction: 'top',
        offset: [0, -34],
        className: 'routetwin-tooltip',
      })
      .addTo(this.map);
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

  /** Vẽ sự cố giao thông theo hợp đồng TrafficMapLayer (bỏ qua sự cố đã thông thoáng). */
  private drawTraffic(layer: TrafficMapLayer) {
    this.trafficLayer.clearLayers();
    this.trafficHaloLayer.clearLayers();
    for (const feature of layer.features) {
      if (feature.properties.status !== 'active') continue;
      const [lng, lat] = feature.geometry.coordinates; // GeoJSON: [lng, lat]
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const { severity, communityReporterCount = 0 } = feature.properties;
      L.circle([lat, lng], {
        radius: HALO_RADIUS_METERS[severity],
        color: SEVERITY_COLORS[severity],
        fillColor: SEVERITY_COLORS[severity],
        fillOpacity: 0.22,
        weight: 1.5,
        opacity: 0.7,
        interactive: false,
      }).addTo(this.trafficHaloLayer);
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
      new Date(iso).toLocaleTimeString(this.language === 'en' ? 'en-US' : 'vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    const reportCount = properties.communityReportCount ?? 1;
    const reporterCount = properties.communityReporterCount ?? 0;
    const freshness = properties.communityUpdatedAt
      ? ` · ${translate(this.language, 'cập nhật')} ${formatTime(properties.communityUpdatedAt)}`
      : ` · ${translate(this.language, 'chưa có xác nhận mới')}`;
    const detail = this.textElement(
      'p',
      translate(this.language, '{count} báo cáo trong 30 phút / 75 m từ {reporters} người{freshness}', {
        count: reportCount,
        reporters: reporterCount,
        freshness,
      }),
    );
    detail.className = 'mb-0 mt-1 text-xs text-slate-500 dark:text-slate-400';
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
              fillColor: '#4338ca',
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

  /**
   * Zoom vừa các điểm trong phần bản đồ còn nhìn thấy: chừa chỗ cho thanh trên (đo thực tế), bảng
   * trái (desktop/tablet, rộng 360-400px) hoặc bảng kéo ở đáy (mobile) và cụm nút nổi bên phải.
   */
  private fit(points: L.LatLngExpression[]) {
    this.lastFitPoints = points;
    const container = this.map.getContainer();
    const { clientWidth, clientHeight } = container;
    const wide = clientWidth >= 768;
    const header = container.parentElement?.querySelector('header');
    const headerBottom = header
      ? header.getBoundingClientRect().bottom - container.getBoundingClientRect().top
      : 0;
    const top = Math.max(wide ? 100 : 64, Math.round(headerBottom) + 12);
    let left: number;
    let right: number;
    let bottom: number;
    if (wide) {
      left = this.fitInsets ? this.fitInsets.left + 24 : clientWidth >= 1024 ? 510 : 460;
      right = 90;
      bottom = 80;
    } else {
      left = 28;
      right = 68; // cụm nút định vị / Việt Nam nằm sát mép phải
      bottom = (this.fitInsets ? this.fitInsets.bottom : 0) + 56; // chừa chỗ cho nút Lớp và cụm nút nổi
      // Bảng quá cao (nấc đầy): vẫn giữ tối thiểu một dải bản đồ để thấy tuyến.
      bottom = Math.min(bottom, Math.max(48, clientHeight - top - 140));
    }
    const tooSmall = clientWidth - left - right < 200 || clientHeight - top - bottom < 140;
    this.map.fitBounds(L.latLngBounds(points), {
      ...(tooSmall
        ? { padding: [70, 70] }
        : { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom] }),
      maxZoom: 15,
    });
  }

  /** Marker POI theo danh mục; chỉ vẽ lại khi danh sách đổi, còn làm nổi bật thì chỉ đổi class. */
  private setPoiMarkers(pois: Poi[], highlightedId: string | null) {
    if (pois !== this.lastPois) {
      this.lastPois = pois;
      this.poiLayer.clearLayers();
      this.poiMarkers.clear();
      for (const poi of pois) {
        const meta = poiMetaFor(poi.category);
        const marker = L.marker([poi.lat, poi.lng], {
          icon: L.divIcon({
            className: 'routetwin-poi-marker',
            html: `<span style="--marker-color:${meta.color}">${iconSvg(meta.icon, 16)}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 36],
          }),
          keyboard: false,
        });
        marker.bindTooltip(this.textElement('span', poi.name), {
          direction: 'top',
          offset: [0, -30],
          className: 'routetwin-tooltip',
        });
        marker.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          this.handlers.onPoiClick?.(poi.id);
        });
        marker.addTo(this.poiLayer);
        this.poiMarkers.set(poi.id, marker);
      }
    }
    for (const [id, marker] of this.poiMarkers) {
      marker.getElement()?.classList.toggle('is-highlighted', id === highlightedId);
    }
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
