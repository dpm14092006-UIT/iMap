import type { TrafficReportDto } from '@routetwin/shared';
import { toTrafficMapLayer, type TrafficMapLayer } from '../../map/layers/trafficMapLayer';
import type { DemoIncident, IncidentKind } from '../components/TrafficReportPanel';

/** Tên hiển thị của từng loại sự cố (dùng chung cho panel, popup bản đồ). */
export const incidentLabels: Record<IncidentKind, string> = {
  traffic_jam: 'Kẹt xe',
  accident: 'Tai nạn',
  construction: 'Thi công',
  flood: 'Ngập đường',
  road_closure: 'Đường đóng',
  obstacle: 'Vật cản',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/** Đổi báo cáo từ API sang dữ liệu hiển thị của panel giao thông. */
export function toIncidents(reports: TrafficReportDto[]): DemoIncident[] {
  return reports.map((report) => ({
    id: report.id,
    type: report.incidentType,
    severity: report.severity,
    description: report.note || incidentLabels[report.incidentType],
    time: formatTime(report.createdAt),
    lat: report.lat,
    lng: report.lng,
    communityReportCount: report.communityReportCount ?? 1,
    communityReporterCount: report.communityReporterCount ?? 0,
    communityUpdatedAt: report.communityUpdatedAt ?? undefined,
    imagePath: report.imagePath,
    status: report.status,
  }));
}

/** Đổi báo cáo từ API sang hợp đồng TrafficMapLayer để bản đồ vẽ marker. */
export function toReportsMapLayer(reports: TrafficReportDto[]): TrafficMapLayer {
  return toTrafficMapLayer(
    reports.map((report) => ({
      id: report.id,
      incidentType: report.incidentType,
      severity: report.severity,
      title: report.note || incidentLabels[report.incidentType],
      lat: report.lat,
      lng: report.lng,
      status: report.status,
      verified: (report.communityReporterCount ?? 0) > 1,
      reportedAt: report.createdAt,
      communityReportCount: report.communityReportCount ?? 1,
      communityReporterCount: report.communityReporterCount ?? 0,
      ...(report.communityUpdatedAt ? { communityUpdatedAt: report.communityUpdatedAt } : {}),
    })),
  );
}
