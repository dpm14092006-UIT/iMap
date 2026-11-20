import type { TrafficReportDto } from '@routetwin/shared';
import type { LatLng } from '../../../shared/geo/types';
import type { DemoIncident } from '../types';
import { toTrafficMapLayer, type TrafficMapLayer } from './trafficMapLayer';
import { toIncidents, toReportsMapLayer } from './trafficPresentation';

type Translate = (text: string) => string;
type Vehicle = 'car' | 'motorcycle';

/** Sự cố cần tránh khi dẫn đường hoặc tính lại tuyến. */
export type AvoidableIncident = LatLng & { id: string; title: string };

export type TrafficOverview = {
  /** Sự cố cho panel giao thông (đã lọc theo loại xe). */
  incidents: DemoIncident[];
  /** Lớp bản đồ: báo cáo thật + sự cố giả của Demo, tiêu đề đã dịch. */
  trafficLayer: TrafficMapLayer;
  /** Sự cố đang hoạt động, mức từ "Vừa" trở lên: cần tránh khi dẫn đường. */
  routeIncidents: AvoidableIncident[];
};

/** Dịch tiêu đề hiển thị trong popup của mọi sự cố trên lớp bản đồ. */
export function translateLayerTitles(layer: TrafficMapLayer, t: Translate): TrafficMapLayer {
  return {
    ...layer,
    features: layer.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, title: t(feature.properties.title) },
    })),
  };
}

/** Sự cố giả của chế độ Demo dưới dạng lớp bản đồ (đường đóng, mức cao, áp dụng mọi loại xe). */
export function demoIncidentLayer(incidents: AvoidableIncident[]): TrafficMapLayer {
  return toTrafficMapLayer(
    incidents.map((incident) => ({
      id: incident.id,
      incidentType: 'road_closure',
      severity: 'high' as const,
      vehicleScope: 'both' as const,
      title: incident.title,
      lat: incident.lat,
      lng: incident.lng,
    })),
  );
}

/** Báo cáo áp dụng cho loại xe đang xem. */
export function reportsForVehicle(reports: TrafficReportDto[], vehicle: Vehicle): TrafficReportDto[] {
  return reports.filter((report) => report.vehicleScope === 'both' || report.vehicleScope === vehicle);
}

/** Gộp lớp báo cáo thật với sự cố giả (giữ nguyên đối tượng khi không có sự cố giả). */
export function mergeDemoIncidents(
  reportsLayer: TrafficMapLayer,
  demoIncidents: AvoidableIncident[],
  t: Translate,
): TrafficMapLayer {
  if (demoIncidents.length === 0) return reportsLayer;
  return {
    ...reportsLayer,
    features: [
      ...reportsLayer.features,
      ...translateLayerTitles(demoIncidentLayer(demoIncidents), t).features,
    ],
  };
}

/** Sự cố đang hoạt động, mức từ "Vừa" trở lên (gồm cả sự cố giả của Demo). */
export function avoidableIncidents(layer: TrafficMapLayer): AvoidableIncident[] {
  return layer.features
    .filter((feature) => feature.properties.status === 'active' && feature.properties.severity !== 'low')
    .map((feature) => ({
      id: feature.properties.id,
      title: feature.properties.title,
      lng: feature.geometry.coordinates[0]!,
      lat: feature.geometry.coordinates[1]!,
    }));
}

/** Toàn bộ bức tranh giao thông trong một lần tính (dùng cho test; hook ghép từng bước bằng useMemo). */
export function buildTrafficOverview(
  reports: TrafficReportDto[],
  vehicle: Vehicle,
  demoIncidents: AvoidableIncident[],
  t: Translate,
): TrafficOverview {
  const visible = reportsForVehicle(reports, vehicle);
  const trafficLayer = mergeDemoIncidents(
    translateLayerTitles(toReportsMapLayer(visible), t),
    demoIncidents,
    t,
  );
  return { incidents: toIncidents(visible), trafficLayer, routeIncidents: avoidableIncidents(trafficLayer) };
}

/** Số liệu cộng đồng của sự cố đang cảnh báo: ưu tiên danh sách báo cáo mới nhất, rồi tới dữ liệu kèm push. */
export function alertCommunityInfo(
  report:
    | Pick<
        TrafficReportDto,
        'communityReportCount' | 'communityReporterCount' | 'communityUpdatedAt' | 'createdAt'
      >
    | null
    | undefined,
  pushed: {
    communityReportCount?: number;
    communityReporterCount?: number;
    communityUpdatedAt?: string | null;
  },
): { reportCount: number; reporterCount: number; updatedAt: string | null } {
  return {
    reportCount: Math.max(1, report?.communityReportCount ?? pushed.communityReportCount ?? 1),
    reporterCount: Math.max(1, report?.communityReporterCount ?? pushed.communityReporterCount ?? 1),
    updatedAt: report?.communityUpdatedAt ?? report?.createdAt ?? pushed.communityUpdatedAt ?? null,
  };
}
