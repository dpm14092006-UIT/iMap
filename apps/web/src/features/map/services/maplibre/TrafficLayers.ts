import { translate, type Language } from '../../../../shared/i18n/translate';
import type { RoutePlan } from '../../../routing/types';
import { routeHazardSection } from '../../../traffic/domain/routeTraffic';
import type {
  TrafficFeature,
  TrafficMapLayer,
  TrafficSeverity,
} from '../../../traffic/domain/trafficMapLayer';
import type { MapOverlays } from '../../types';
import { circlePolygon } from '../../../../shared/geo/circlePolygon';
import { coordinateToLngLat, ensureLayer, maplibregl, OverlaySource, textElement, type GLMap } from './gl';
import { markerElement } from './markers';

/** Mức sự cố → màu giao thông (cùng bảng màu với chú giải: vàng / đỏ / đỏ sẫm). */
export const SEVERITY_COLORS: Record<TrafficSeverity, string> = {
  low: '#facc15',
  medium: '#ef4444',
  high: '#991b1b',
};
const HALO_RADIUS_METERS: Record<TrafficSeverity, number> = { low: 200, medium: 280, high: 360 };
const SEVERITY_RANK: Record<TrafficSeverity, number> = { low: 0, medium: 1, high: 2 };

/**
 * Giao thông trên bản đồ theo hợp đồng TrafficMapLayer: quầng màu quanh sự cố (dưới tuyến), đoạn tuyến
 * đi qua sự cố tô theo mức độ, và marker sự cố có popup số liệu cộng đồng.
 */
export class TrafficLayers {
  readonly halo: OverlaySource;
  readonly sections: OverlaySource;
  private markers: maplibregl.Marker[] = [];
  private visible: MapOverlays = { traffic: true, incidents: true, terrain: false };

  constructor(
    private readonly map: GLMap,
    private readonly language: () => Language,
  ) {
    this.halo = new OverlaySource(map, 'rt-traffic-halo');
    this.sections = new OverlaySource(map, 'rt-traffic-sections');
  }

  /** Quầng nằm dưới tuyến: cài trước RouteLayer. */
  installHalo() {
    this.halo.install();
    ensureLayer(this.map, {
      id: 'rt-traffic-halo-fill',
      type: 'fill',
      source: this.halo.id,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.22 },
    });
    ensureLayer(this.map, {
      id: 'rt-traffic-halo-line',
      type: 'line',
      source: this.halo.id,
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.7 },
    });
    this.applyVisibility();
  }

  /** Đoạn sự cố trên tuyến nằm trên tuyến: cài sau RouteLayer. */
  installSections() {
    this.sections.install();
    const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
    ensureLayer(this.map, {
      id: 'rt-traffic-section-casing',
      type: 'line',
      source: this.sections.id,
      layout: round,
      paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.94 },
    });
    ensureLayer(this.map, {
      id: 'rt-traffic-section',
      type: 'line',
      source: this.sections.id,
      layout: { ...round, 'line-sort-key': ['get', 'rank'] },
      paint: { 'line-color': ['get', 'color'], 'line-width': 5.5 },
    });
    this.applyVisibility();
  }

  /** Bật/tắt quầng giao thông + màu đoạn tắc trên tuyến (traffic) và marker sự cố (incidents). */
  setVisibility(overlays: MapOverlays) {
    this.visible = overlays;
    this.applyVisibility();
  }

  /** Vẽ sự cố giao thông (bỏ qua sự cố đã thông thoáng). */
  drawIncidents(layer: TrafficMapLayer) {
    for (const marker of this.markers) marker.remove();
    this.markers = [];
    const halos: GeoJSON.Feature[] = [];
    for (const feature of layer.features) {
      if (feature.properties.status !== 'active') continue;
      const [lng, lat] = feature.geometry.coordinates; // GeoJSON: [lng, lat]
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const { severity, communityReporterCount = 0 } = feature.properties;
      halos.push({
        type: 'Feature',
        geometry: circlePolygon({ lat, lng }, HALO_RADIUS_METERS[severity]),
        properties: { color: SEVERITY_COLORS[severity] },
      });
      const label = communityReporterCount > 1 ? String(communityReporterCount) : '!';
      const element = markerElement(`routetwin-incident-marker ${severity}`);
      element.append(textElement('span', label));
      const marker = new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 16, maxWidth: '260px' }).setDOMContent(this.popup(feature)));
      // Không chặn sự kiện bấm ở đây: MapLibre mở popup qua sự kiện click của bản đồ. Bộ điều khiển bỏ qua
      // lần bấm trúng marker nên không bị hiểu là chọn điểm trên bản đồ.
      this.markers.push(marker);
    }
    this.halo.set({ type: 'FeatureCollection', features: halos });
    this.applyVisibility();
  }

  /** Tô riêng đoạn có sự cố để mức vừa/cao hiện lần lượt vàng/đỏ trên tuyến màu xanh. */
  drawRouteSections(route: RoutePlan | null, traffic: TrafficMapLayer) {
    const features: GeoJSON.Feature[] = [];
    if (route) {
      const reports = traffic.features.filter((feature) => feature.properties.status === 'active');
      for (const feature of reports) {
        const [lng, lat] = feature.geometry.coordinates;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        const section = routeHazardSection(route, { lat, lng });
        if (!section || section.distanceMeters > 180 || section.points.length < 2) continue;
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: section.points.map(coordinateToLngLat) },
          properties: {
            color: SEVERITY_COLORS[feature.properties.severity],
            rank: SEVERITY_RANK[feature.properties.severity],
          },
        });
      }
    }
    this.sections.set({ type: 'FeatureCollection', features });
  }

  destroy() {
    for (const marker of this.markers) marker.remove();
    this.markers = [];
  }

  private applyVisibility() {
    const traffic = this.visible.traffic ? 'visible' : 'none';
    for (const id of [
      'rt-traffic-halo-fill',
      'rt-traffic-halo-line',
      'rt-traffic-section-casing',
      'rt-traffic-section',
    ])
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', traffic);
    for (const marker of this.markers) {
      const shown = marker.getElement().isConnected;
      if (this.visible.incidents && !shown) marker.addTo(this.map);
      else if (!this.visible.incidents && shown) marker.remove();
    }
  }

  /** Popup sự cố: tiêu đề + số báo cáo được gộp và số người xác nhận (dữ liệu cộng đồng). */
  private popup({ properties }: TrafficFeature): HTMLElement {
    const language = this.language();
    const content = document.createElement('div');
    const formatTime = (iso: string) =>
      new Date(iso).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    const reportCount = Math.max(1, properties.communityReportCount ?? 1);
    const reporterCount = Math.max(1, properties.communityReporterCount ?? 1);
    const freshness = properties.communityUpdatedAt
      ? ` · ${translate(language, 'cập nhật')} ${formatTime(properties.communityUpdatedAt)}`
      : ` · ${translate(language, 'chưa có xác nhận mới')}`;
    const detail = textElement(
      'p',
      translate(language, '{count} báo cáo trong 30 phút / 75 m từ {reporters} người{freshness}', {
        count: reportCount,
        reporters: reporterCount,
        freshness,
      }),
    );
    detail.className = 'mb-0 mt-1 text-xs text-slate-500 dark:text-slate-400';
    content.append(textElement('strong', properties.title), detail);
    return content;
  }
}
