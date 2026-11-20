import type { TrafficReportDto } from '@routetwin/shared';
import type { LatLng } from '../../../shared/geo/types';
import type { TrafficIncident } from '../types';
import { type TrafficMapLayer } from './trafficMapLayer';
import { toIncidents, toReportsMapLayer } from './trafficPresentation';

type Translate = (text: string) => string;
type Vehicle = 'car' | 'motorcycle';

/** Sự cố cần tránh khi dẫn đường hoặc tính lại tuyến. */
export type AvoidableIncident = LatLng & { id: string; title: string };

export type TrafficOverview = {
  /** Sự cố cho panel giao thông (đã lọc theo loại xe). */
  incidents: TrafficIncident[];
  /** Lớp bản đồ báo cáo cộng đồng, tiêu đề đã dịch. */
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

/** Báo cáo áp dụng cho loại xe đang xem. */
export function reportsForVehicle(reports: TrafficReportDto[], vehicle: Vehicle): TrafficReportDto[] {
  return reports.filter((report) => report.vehicleScope === 'both' || report.vehicleScope === vehicle);
}

/** Sự cố đang hoạt động, mức từ "Vừa" trở lên. */
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
  t: Translate,
): TrafficOverview {
  const visible = reportsForVehicle(reports, vehicle);
  const trafficLayer = translateLayerTitles(toReportsMapLayer(visible), t);
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
