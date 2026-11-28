import type { LatLng } from '../../../shared/geo/types';
import type { Language } from '../../../shared/i18n/translate';
import type { RoutePlan } from '../../routing/types';
import type { TrafficMapLayer } from '../../traffic/domain/trafficMapLayer';
import type { FitInsets, MapController, MapControllerData, MapControllerHandlers } from './MapController';
import { ArchipelagoLabels } from './maplibre/ArchipelagoLabels';
import { AttributionLine } from './maplibre/AttributionLine';
import { maplibregl, toGLZoom, transformMapRequest, VIETNAM_CENTER_LNGLAT, type GLMap } from './maplibre/gl';
import { MaplibreBasemap } from './maplibre/MaplibreBasemap';
import { MaplibreCamera } from './maplibre/MaplibreCamera';
import { FocusPin, LocationMarker, PoiMarkers } from './maplibre/markers';
import { Map3D } from './maplibre/Map3D';
import { ALTERNATIVE_ROUTE_LAYER, RouteLayer } from './maplibre/RouteLayer';
import { SunLight } from './maplibre/SunLight';
import { TrafficLayers } from './maplibre/TrafficLayers';
import { VietnamInset } from './maplibre/VietnamInset';

/**
 * Bộ máy bản đồ MapLibre GL (WebGL): theo hợp đồng MapController, có nghiêng,
 * xoay (3D). Mỗi loại dữ liệu do một lớp trong `./maplibre/` vẽ; lớp này quyết định KHI NÀO vẽ lại và
 * cài lại các lớp của iMap mỗi khi đổi nền (setStyle xóa mọi lớp).
 */
export class MaplibreMapController implements MapController {
  private language: Language = 'vi';
  private readonly map: GLMap;
  private readonly base: MaplibreBasemap;
  private readonly attribution = new AttributionLine();
  private readonly archipelagoLabels: ArchipelagoLabels;
  private readonly inset: VietnamInset;
  private readonly camera: MaplibreCamera;
  private readonly routeLayer: RouteLayer;
  private readonly traffic: TrafficLayers;
  private readonly pois: PoiMarkers;
  private readonly location: LocationMarker;
  private readonly focus: FocusPin;
  private readonly map3d: Map3D;
  private readonly sun: SunLight;
  private readonly playbackMarker: LocationMarker;
  private playing = false;
  private destroyed = false;
  private view3d = false;
  private navigating = false;
  private heading: number | null = null;
  private cameraFrame = 0;

  private lastRouteId: string | null = null;
  private lastRouteOptionsKey = '';
  private lastRouteNavigationState: boolean | null = null;
  private lastCongestionVisible: boolean | null = null;
  private lastDraftStopsKey = '';
  private lastTrafficMapLayer: TrafficMapLayer | null = null;

  private readonly reportBounds = () => this.handlers.onBoundsChange?.(this.camera.getBounds());

  constructor(
    container: HTMLElement,
    private readonly handlers: MapControllerHandlers,
  ) {
    this.map = new maplibregl.Map({
      container,
      center: VIETNAM_CENTER_LNGLAT,
      zoom: toGLZoom(5),
      // Giới hạn zoom 1–19 theo thang ô 256 px của ứng dụng.
      minZoom: toGLZoom(1),
      maxZoom: toGLZoom(19),
      maxPitch: 60,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      transformRequest: transformMapRequest,
      style: { version: 8, sources: {}, layers: [] },
    });
    container.classList.add('routetwin-map');
    // Dock nằm đè góc trái nên ghi công và thước tỉ lệ đặt ở góc dưới phải.
    this.map.addControl(this.attribution, 'bottom-right');
    this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 80 }), 'bottom-right');

    const language = () => this.language;
    let labels: ArchipelagoLabels | null = null;
    this.base = new MaplibreBasemap(this.map, import.meta.env.PROD, (provider) => {
      labels?.setSuppressed(Boolean(provider?.sovereigntyLabels));
      this.attribution.set('base', provider?.attribution ?? null);
    });
    // Tên Quần đảo Hoàng Sa, Trường Sa (Việt Nam) luôn hiện, mọi lớp nền.
    this.archipelagoLabels = labels = new ArchipelagoLabels(this.map, this.language);
    labels.setSuppressed(Boolean(this.base.currentProvider()?.sovereigntyLabels));
    // Bản đồ phụ toàn vẹn lãnh thổ khi chỉ xem một phần (Điều 20.2–20.3, TT 17/2018/TT-BTNMT).
    this.inset = new VietnamInset(
      () => this.camera.showVietnam(),
      (text) => this.attribution.set('inset', text),
    );
    this.camera = new MaplibreCamera(this.map, () => this.inset.footprint());
    this.map.addControl(this.inset, 'top-right');
    this.traffic = new TrafficLayers(this.map, language);
    this.routeLayer = new RouteLayer(this.map, language, handlers.onSelectRoute);
    this.pois = new PoiMarkers(this.map, handlers.onPoiClick);
    this.focus = new FocusPin(this.map);
    this.location = new LocationMarker(this.map);
    this.playbackMarker = new LocationMarker(this.map);
    this.sun = new SunLight(this.map);
    this.map3d = new Map3D(this.map, import.meta.env.PROD, (text) => this.attribution.set('3d', text));

    this.map.on('style.load', this.reinstall);
    this.map.on('moveend', this.reportBounds);
    this.map.on('click', this.onClick);
    this.map.on('mousemove', this.onHover);
    this.map.on('rotate', this.reportCamera);
    this.map.on('pitch', this.reportCamera);
    this.map.on('moveend', this.reportCamera);
    handlers.onBoundsChange?.(this.camera.getBounds());
    // Khung đầu tiên: toàn vẹn lãnh thổ.
    this.camera.showVietnam();
  }

  /** Vẽ lại bản đồ theo dữ liệu mới nhất. */
  update(data: MapControllerData) {
    if (this.destroyed) return;
    const languageChanged = data.language !== this.language;
    this.language = data.language;
    this.base.apply(data.layer, data.overlays.terrain);
    this.archipelagoLabels.setLanguage(data.language);
    this.traffic.setVisibility(data.overlays);
    this.map.getContainer().classList.toggle('is-picking', data.isPicking);
    this.pois.update(data.pois, data.highlightedPoiId);
    this.apply3d(data);
    this.inset.setSuspended(data.isNavigating);
    this.sun.set(data.lightTime);

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
      this.camera.fit(
        routes.flatMap((route) =>
          route.legs.flatMap((leg) => leg.points.map(([lat, lng]) => ({ lat, lng }))),
        ),
      );
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
    // Dẫn đường 3D: xoay theo hướng đi; giảm chuyển động hoặc chưa có hướng thì bám vị trí như 2D.
    if (this.view3d && this.navigating && this.heading !== null && !this.camera.prefersReducedMotion())
      this.camera.followHeading(point, zoom, this.heading);
    else this.camera.followLocation(point, zoom);
  }
  showPlayback(frame: { point: LatLng; heading: number } | null) {
    if (this.destroyed) return;
    if (!frame) {
      if (!this.playing) return;
      this.playing = false;
      this.playbackMarker.destroy();
      this.camera.clearPadding();
      this.camera.setPitchMode(this.view3d, true);
      return;
    }
    this.playing = true;
    this.playbackMarker.update(frame.point, true, frame.heading);
    // Camera nghiêng bay theo tuyến; giảm chuyển động thì chỉ bám vị trí, không xoay.
    this.camera.playbackFrame(frame.point, 16, this.camera.prefersReducedMotion() ? null : frame.heading);
  }
  resetNorth() {
    this.camera.resetNorth();
  }
  onUserGesture(listener: () => void): () => void {
    return this.camera.onUserGesture(listener);
  }
  getZoom(): number {
    return this.camera.getZoom();
  }
  getCenter(): LatLng {
    return this.camera.getCenter();
  }
  fitPoints(points: LatLng[]) {
    this.camera.fit(points);
  }
  fitRoute(route: RoutePlan) {
    this.camera.fit(route.legs.flatMap((leg) => leg.points.map(([lat, lng]) => ({ lat, lng }))));
  }
  setFitInsets(insets: FitInsets | null) {
    this.camera.setFitInsets(insets);
  }
  refit() {
    this.camera.refit();
  }
  invalidateSize() {
    if (!this.destroyed) this.map.resize();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.map.off('moveend', this.reportBounds);
    this.map.off('style.load', this.reinstall);
    cancelAnimationFrame(this.cameraFrame);
    this.routeLayer.destroy();
    this.traffic.destroy();
    this.pois.clear();
    this.focus.destroy();
    this.location.destroy();
    this.playbackMarker.destroy();
    this.archipelagoLabels.destroy();
    this.base.destroy();
    this.map.remove();
  }

  /** Nguồn nền đang hiển thị (kiểm thử, cổng kiểm chứng). */
  activeBasemapId(): string | null {
    return this.base.activeProviderId();
  }

  /** Mốc thời gian đang mô phỏng ánh sáng (kiểm thử). */
  lightTime(): number | null {
    return this.sun.current();
  }

  /**
   * Sau mỗi lần đổi nền, cài lại nguồn và lớp của iMap. Thứ tự = thứ tự chồng: nền → quầng giao thông →
   * tuyến → đoạn sự cố trên tuyến. Nhãn, marker (HTML) luôn nằm trên khung vẽ nên không cần cài lại.
   */
  private readonly reinstall = () => {
    if (this.destroyed) return;
    this.traffic.installHalo();
    this.routeLayer.install();
    this.traffic.installSections();
    this.map3d.apply(this.base.currentProvider(), this.view3d);
    this.sun.apply();
  };

  /** Chuyển 2D/3D; kết thúc dẫn đường 3D thì quay lại hướng Bắc (vẫn giữ nghiêng nếu đang 3D). */
  private apply3d(data: MapControllerData) {
    const wasNavigating = this.navigating;
    this.navigating = data.isNavigating;
    this.heading = data.headingDegrees;
    if (data.view3d !== this.view3d) {
      this.view3d = data.view3d;
      this.camera.setPitchMode(data.view3d);
      this.map3d.apply(this.base.currentProvider(), data.view3d);
    } else if (wasNavigating && !data.isNavigating) this.camera.setPitchMode(this.view3d, true);
  }

  /** Báo hướng xoay/độ nghiêng cho la bàn, gộp theo khung hình. */
  private readonly reportCamera = () => {
    if (this.cameraFrame || this.destroyed) return;
    this.cameraFrame = requestAnimationFrame(() => {
      this.cameraFrame = 0;
      if (!this.destroyed)
        this.handlers.onCameraChange?.({ bearing: this.map.getBearing(), pitch: this.map.getPitch() });
    });
  };

  /** Bấm trúng marker/nhãn/popup thì không tính là bấm bản đồ; bấm tuyến phụ thì chọn tuyến đó. */
  private readonly onClick = (event: maplibregl.MapMouseEvent) => {
    const target = event.originalEvent.target;
    if (
      target instanceof Element &&
      target.closest('.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl')
    )
      return;
    const routeId = this.routeAt(event.point);
    if (routeId) {
      this.handlers.onSelectRoute?.(routeId);
      return;
    }
    this.handlers.onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
  };

  private readonly onHover = (event: maplibregl.MapMouseEvent) => {
    this.map.getCanvas().style.cursor = this.routeAt(event.point) ? 'pointer' : '';
  };

  private routeAt(point: maplibregl.Point): string | null {
    if (!this.map.getLayer(ALTERNATIVE_ROUTE_LAYER)) return null;
    const [feature] = this.map.queryRenderedFeatures(
      [
        [point.x - 6, point.y - 6],
        [point.x + 6, point.y + 6],
      ],
      { layers: [ALTERNATIVE_ROUTE_LAYER] },
    );
    const routeId = feature?.properties?.routeId;
    return typeof routeId === 'string' ? routeId : null;
  }
}
