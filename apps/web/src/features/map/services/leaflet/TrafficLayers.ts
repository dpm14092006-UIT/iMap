import * as L from 'leaflet';
import { translate, type Language } from '../../../../shared/i18n/translate';
import type { RoutePlan } from '../../../routing/types';
import { routeHazardSection } from '../../../traffic/domain/routeTraffic';
import type {
  TrafficFeature,
  TrafficMapLayer,
  TrafficSeverity,
} from '../../../traffic/domain/trafficMapLayer';
import type { MapOverlays } from '../../types';
import { drawWhiteCasing, ROUND, SEVERITY_COLORS, textElement, toggleGroup } from './drawing';

const HALO_RADIUS_METERS: Record<TrafficSeverity, number> = { low: 200, medium: 280, high: 360 };

/**
 * Giao thông trên bản đồ theo hợp đồng TrafficMapLayer: quầng màu quanh sự cố (dưới tuyến), đoạn tuyến
 * đi qua sự cố tô theo mức độ, và marker sự cố có popup số liệu cộng đồng.
 */
export class TrafficLayers {
  /** Quầng giao thông nằm dưới tuyến. */
  readonly halo = L.layerGroup();
  readonly routeSections = L.layerGroup();
  readonly markers = L.layerGroup();

  constructor(
    private readonly map: L.Map,
    private readonly language: () => Language,
  ) {}

  /** Bật/tắt quầng giao thông + màu đoạn tắc trên tuyến (traffic) và marker sự cố (incidents). */
  setVisibility({ traffic, incidents }: MapOverlays) {
    toggleGroup(this.map, this.halo, traffic);
    toggleGroup(this.map, this.routeSections, traffic);
    toggleGroup(this.map, this.markers, incidents);
  }

  /** Vẽ sự cố giao thông (bỏ qua sự cố đã thông thoáng). */
  drawIncidents(layer: TrafficMapLayer) {
    this.markers.clearLayers();
    this.halo.clearLayers();
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
      }).addTo(this.halo);
      const marker = L.marker([lat, lng], {
        icon: this.incidentIcon(severity, communityReporterCount),
        keyboard: false,
      }).addTo(this.markers);
      marker.bindPopup(this.popup(feature));
    }
  }

  /** Tô riêng đoạn có sự cố để mức vừa/cao hiện lần lượt vàng/đỏ trên tuyến màu xanh. */
  drawRouteSections(route: RoutePlan | null, traffic: TrafficMapLayer) {
    this.routeSections.clearLayers();
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
      drawWhiteCasing(section.points, this.routeSections);
      L.polyline(section.points, {
        ...ROUND,
        color: SEVERITY_COLORS[feature.properties.severity],
        weight: 5.5,
        opacity: 1,
        interactive: false,
      }).addTo(this.routeSections);
    }
  }

  /** Popup sự cố: tiêu đề + số báo cáo được gộp và số người xác nhận (dữ liệu cộng đồng từ N2). */
  private popup({ properties }: TrafficFeature): HTMLElement {
    const language = this.language();
    const content = document.createElement('div');
    const formatTime = (iso: string) =>
      new Date(iso).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    // Có báo cáo thì luôn có ít nhất một người gửi.
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

  /** Marker sự cố: màu theo mức độ; hiện số người xác nhận khi có từ 2 người trở lên, nếu không thì "!". */
  private incidentIcon(severity: TrafficSeverity, communityReporterCount: number) {
    const label = communityReporterCount > 1 ? String(communityReporterCount) : '!';
    return L.divIcon({
      className: `routetwin-incident-marker ${severity}`,
      html: `<span>${label}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }
}
