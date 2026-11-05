import type { TrafficReportBounds, TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import type { TrafficReportRepository } from '../../application/ports/TrafficReportRepository.js';
import { SupabaseClientFactory } from '../../../../shared/supabase/SupabaseClientFactory.js';
import { AppError } from '../../../../shared/errors/AppError.js';

type DbTrafficReport = {
  id: string;
  incident_type: TrafficReportDto['incidentType'];
  severity: TrafficReportDto['severity'];
  lat: number;
  lng: number;
  note: string | null;
  gps_accuracy_m: number | null;
  heading_deg: number | null;
  image_path: string | null;
  status: TrafficReportDto['status'];
  created_at: string;
  expires_at: string;
  version: number;
  user_id?: string | null;
  community_report_count?: number;
  community_reporter_count?: number;
  community_updated_at?: string | null;
};

export class SupabaseTrafficReportRepository implements TrafficReportRepository {
  constructor(private readonly clients = new SupabaseClientFactory()) {}

  async list(bounds: TrafficReportBounds, accessToken?: string): Promise<TrafficReportDto[]> {
    const { data, error } = await this.clients.create(accessToken).rpc('get_traffic_reports_bbox', {
      p_min_lat: bounds.minLat,
      p_min_lng: bounds.minLng,
      p_max_lat: bounds.maxLat,
      p_max_lng: bounds.maxLng,
    });
    if (error) throw this.toAppError(error);
    return (data ?? []).map((row: DbTrafficReport) => this.toDto(row));
  }

  async create(input: TrafficReportInput, accessToken: string): Promise<TrafficReportDto> {
    const { data, error } = await this.clients.create(accessToken).rpc('create_traffic_report', {
      p_incident_type: input.incidentType,
      p_severity: input.severity,
      p_lat: input.lat,
      p_lng: input.lng,
      p_note: input.note ?? null,
      p_gps_accuracy_m: input.gpsAccuracyM ?? null,
      p_heading_deg: input.headingDeg ?? null,
      p_image_path: input.imagePath ?? null,
    }).single();
    if (error) throw this.toAppError(error);
    return this.toDto(data as DbTrafficReport);
  }

  async updateClearance(id: string, state: 'clear' | 'still_active', accessToken: string): Promise<TrafficReportDto> {
    const { data, error } = await this.clients.create(accessToken).rpc('update_traffic_report_clearance', {
      p_report_id: id,
      p_state: state,
    }).single();
    if (error) throw this.toAppError(error);
    return this.toDto(data as DbTrafficReport);
  }

  private toDto(row: DbTrafficReport): TrafficReportDto {
    return {
      id: row.id,
      incidentType: row.incident_type,
      severity: row.severity,
      lat: Number(row.lat),
      lng: Number(row.lng),
      ...(row.note ? { note: row.note } : {}),
      ...(row.gps_accuracy_m !== null ? { gpsAccuracyM: Number(row.gps_accuracy_m) } : {}),
      ...(row.heading_deg !== null ? { headingDeg: Number(row.heading_deg) } : {}),
      ...(row.image_path ? { imagePath: row.image_path } : {}),
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      version: Number(row.version),
      communityReportCount: Number(row.community_report_count ?? 1),
      communityReporterCount: Number(row.community_reporter_count ?? (row.user_id ? 1 : 0)),
      communityUpdatedAt: row.community_updated_at === undefined ? row.created_at : row.community_updated_at,
    };
  }

  private toAppError(error: { code?: string; message?: string }): AppError {
    if (error.code === 'P0002') return new AppError(404, 'REPORT_NOT_FOUND', 'Không tìm thấy báo cáo giao thông');
    if (error.code === 'P0001' && error.message?.includes('REPORT_RATE_LIMIT')) return new AppError(429, 'REPORT_RATE_LIMIT', error.message.split(': ').slice(1).join(': '));
    if (error.code === 'P0001' && error.message?.includes('REPORT_EXPIRED')) return new AppError(410, 'REPORT_EXPIRED', 'Báo cáo này đã hết hạn');
    if (error.code === 'P0001') return new AppError(429, 'REPORT_UPDATE_COOLDOWN', error.message?.split(': ').slice(1).join(': ') ?? 'Vui lòng chờ trước khi xác minh lại báo cáo');
    if (error.code === '42501') return new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập lại');
    if (error.code === '22023') return new AppError(400, 'INVALID_TRAFFIC_INPUT', 'Thông tin giao thông không hợp lệ');
    console.error('Supabase traffic operation failed', { code: error.code });
    return new AppError(503, 'TRAFFIC_DATA_UNAVAILABLE', 'Không thể tải dữ liệu giao thông lúc này');
  }
}
