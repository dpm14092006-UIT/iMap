import type { TrafficReportDto } from '@routetwin/shared';

export type RealtimeTrafficReport = Pick<
  TrafficReportDto,
  'id' | 'incidentType' | 'severity' | 'vehicleScope' | 'lat' | 'lng' | 'status' | 'version'
>;

/**
 * Kiểm tra dữ liệu báo cáo đến từ bên ngoài (Supabase Realtime, Web Push qua service worker)
 * trước khi dùng; sai kiểu hoặc thiếu trường thì trả null.
 */
export function parseRealtimeReport(value: unknown): RealtimeTrafficReport | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const validIncidentTypes = ['traffic_jam', 'accident', 'construction', 'flood', 'road_closure', 'obstacle'];
  const vehicleScope = payload.vehicleScope ?? 'both';
  if (
    typeof payload.id !== 'string' ||
    typeof payload.incidentType !== 'string' ||
    !validIncidentTypes.includes(payload.incidentType) ||
    typeof payload.severity !== 'string' ||
    !['low', 'medium', 'high'].includes(payload.severity) ||
    typeof vehicleScope !== 'string' ||
    !['car', 'motorcycle', 'both'].includes(vehicleScope) ||
    typeof payload.lat !== 'number' ||
    !Number.isFinite(payload.lat) ||
    payload.lat < -90 ||
    payload.lat > 90 ||
    typeof payload.lng !== 'number' ||
    !Number.isFinite(payload.lng) ||
    payload.lng < -180 ||
    payload.lng > 180 ||
    typeof payload.status !== 'string' ||
    !['active', 'cleared', 'expired'].includes(payload.status) ||
    (payload.version !== undefined &&
      (typeof payload.version !== 'number' || !Number.isSafeInteger(payload.version) || payload.version <= 0))
  ) {
    return null;
  }
  return {
    id: payload.id,
    incidentType: payload.incidentType as TrafficReportDto['incidentType'],
    severity: payload.severity as TrafficReportDto['severity'],
    vehicleScope: vehicleScope as TrafficReportDto['vehicleScope'],
    lat: payload.lat,
    lng: payload.lng,
    status: payload.status as TrafficReportDto['status'],
    version: typeof payload.version === 'number' ? payload.version : 1,
  };
}

/** Số liệu cộng đồng đi kèm báo cáo (có trong Web Push, không có trong Realtime); bỏ trường sai kiểu. */
export type CommunityCounts = {
  communityReportCount?: number;
  communityReporterCount?: number;
  communityUpdatedAt?: string;
};

export function pickCommunityCounts(report: object): CommunityCounts {
  const value = report as Record<keyof CommunityCounts, unknown>;
  return {
    ...(typeof value.communityReportCount === 'number'
      ? { communityReportCount: value.communityReportCount }
      : {}),
    ...(typeof value.communityReporterCount === 'number'
      ? { communityReporterCount: value.communityReporterCount }
      : {}),
    ...(typeof value.communityUpdatedAt === 'string' ? { communityUpdatedAt: value.communityUpdatedAt } : {}),
  };
}
