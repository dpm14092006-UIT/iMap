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
    !validIncidentTypes.includes(String(payload.incidentType)) ||
    !['low', 'medium', 'high'].includes(String(payload.severity)) ||
    !['car', 'motorcycle', 'both'].includes(String(vehicleScope)) ||
    typeof payload.lat !== 'number' ||
    payload.lat < -90 ||
    payload.lat > 90 ||
    typeof payload.lng !== 'number' ||
    payload.lng < -180 ||
    payload.lng > 180 ||
    !['active', 'cleared', 'expired'].includes(String(payload.status))
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
