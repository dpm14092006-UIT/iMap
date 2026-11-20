import type { TrafficReportDto } from '@routetwin/shared';
import type { DemoIncident, IncidentKind } from '../types';
import { toTrafficMapLayer, type TrafficMapLayer } from './trafficMapLayer';
import type { TrafficImageAnalysisDto } from '@routetwin/shared';
import type { IncidentSeverity, TrafficVehicleScope } from '../types';

/** Tên hiển thị của từng loại sự cố (dùng chung cho panel, popup bản đồ). */
export const incidentLabels: Record<IncidentKind, string> = {
  traffic_jam: 'Kẹt xe',
  accident: 'Tai nạn',
  construction: 'Thi công',
  flood: 'Ngập đường',
  road_closure: 'Đường đóng',
  obstacle: 'Vật cản',
};

/** Đổi báo cáo từ API sang dữ liệu hiển thị của panel giao thông. */
export function toIncidents(reports: TrafficReportDto[]): DemoIncident[] {
  return reports.map((report) => ({
    id: report.id,
    type: report.incidentType,
    severity: report.severity,
    vehicleScope: report.vehicleScope,
    description: report.note || incidentLabels[report.incidentType],
    time: report.createdAt,
    lat: report.lat,
    lng: report.lng,
    communityReportCount: Math.max(1, report.communityReportCount ?? 1),
    communityReporterCount: Math.max(1, report.communityReporterCount ?? 1),
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
      vehicleScope: report.vehicleScope,
      title: report.note || incidentLabels[report.incidentType],
      lat: report.lat,
      lng: report.lng,
      status: report.status,
      verified: (report.communityReporterCount ?? 0) > 1,
      reportedAt: report.createdAt,
      communityReportCount: Math.max(1, report.communityReportCount ?? 1),
      communityReporterCount: Math.max(1, report.communityReporterCount ?? 1),
      ...(report.communityUpdatedAt ? { communityUpdatedAt: report.communityUpdatedAt } : {}),
    })),
  );
}
export const severityOptions: { id: IncidentSeverity; label: string; color: string }[] = [
  { id: 'low', label: 'Nhẹ', color: 'bg-emerald-500' },
  { id: 'medium', label: 'Vừa', color: 'bg-amber-500' },
  { id: 'high', label: 'Nặng', color: 'bg-red-500' },
];
export const vehicleScopeLabels: Record<TrafficVehicleScope, string> = {
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  both: 'Cả hai',
};
export const incidentOptions: {
  id: IncidentKind;
  label: string;
  icon: 'traffic' | 'car' | 'road' | 'globe' | 'close-circle' | 'layers';
}[] = [
  { id: 'traffic_jam', label: incidentLabels.traffic_jam, icon: 'traffic' },
  { id: 'accident', label: incidentLabels.accident, icon: 'car' },
  { id: 'construction', label: incidentLabels.construction, icon: 'road' },
  { id: 'flood', label: incidentLabels.flood, icon: 'globe' },
  { id: 'road_closure', label: incidentLabels.road_closure, icon: 'close-circle' },
  { id: 'obstacle', label: incidentLabels.obstacle, icon: 'layers' },
];
export const confidenceLabels: Record<TrafficImageAnalysisDto['confidence'], string> = {
  high: 'cao',
  medium: 'vừa',
  low: 'thấp',
};
