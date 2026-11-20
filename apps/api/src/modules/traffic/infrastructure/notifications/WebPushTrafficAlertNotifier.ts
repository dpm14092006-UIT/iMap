import type { TrafficReportDto } from '@routetwin/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';
import type { TrafficAlertNotifier } from '../../application/ports/TrafficAlertNotifier.js';
import { isAllowedPushEndpoint } from '../../domain/pushEndpointPolicy.js';

type Watcher = {
  endpoint: string;
  p256dh: string;
  auth: string;
  community_report_count: number | null;
  community_reporter_count: number | null;
  community_updated_at: string | null;
};

export type WebPushConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  publicKey: string;
  privateKey: string;
  subject: string;
};

const incidentLabels: Record<TrafficReportDto['incidentType'], string> = {
  traffic_jam: 'Kẹt xe',
  accident: 'Tai nạn',
  construction: 'Công trình',
  flood: 'Ngập nước',
  road_closure: 'Đường bị chặn',
  obstacle: 'Vật cản',
};
const severityLabels: Record<TrafficReportDto['severity'], string> = {
  low: 'nhẹ',
  medium: 'vừa',
  high: 'nặng',
};
/** Hành lang quanh tuyến (mét) để coi sự cố nằm trên tuyến của xe. */
const ROUTE_CORRIDOR_METERS = 150;
const SEND_CONCURRENCY = 20;
/** Mỗi lần gửi tối đa bao lâu, để một push service chậm không giữ cả lượt gửi. */
const SEND_TIMEOUT_MS = 10_000;

/** Nội dung thông báo dùng chung cho Web Push và test. */
export function trafficPushPayload(report: TrafficReportDto, watcher?: Partial<Watcher>) {
  const reportCount = Math.max(1, watcher?.community_report_count ?? report.communityReportCount ?? 1);
  const reporterCount = Math.max(1, watcher?.community_reporter_count ?? report.communityReporterCount ?? 1);
  const updatedAt = watcher?.community_updated_at ?? report.communityUpdatedAt ?? report.createdAt;
  const time = new Date(updatedAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const incident = incidentLabels[report.incidentType];
  return {
    type: 'traffic_report' as const,
    title: `⚠️ ${incident} trên tuyến của bạn`,
    body: `${incident} mức ${severityLabels[report.severity]} · ${reportCount} báo cáo trong 30 phút / 75 m từ ${reporterCount} người · cập nhật ${time}. Mở để xem đường khác.`,
    // Cùng cụm sự cố thì thay thông báo cũ thay vì chồng nhiều cái.
    tag: `traffic-${report.incidentType}-${report.lat.toFixed(3)}-${report.lng.toFixed(3)}`,
    report: {
      id: report.id,
      incidentType: report.incidentType,
      severity: report.severity,
      vehicleScope: report.vehicleScope,
      lat: report.lat,
      lng: report.lng,
      status: report.status,
      version: report.version ?? 1,
      communityReportCount: reportCount,
      communityReporterCount: reporterCount,
      communityUpdatedAt: updatedAt,
    },
  };
}

/**
 * Tìm các trình duyệt có tuyến đang đi qua điểm sự cố (PostGIS, RPC chỉ service_role gọi được)
 * rồi gửi Web Push. Đăng ký hết hạn (404/410) hoặc endpoint ngoài chính sách (chống SSRF) được xóa luôn.
 */
export class WebPushTrafficAlertNotifier implements TrafficAlertNotifier {
  private readonly client: SupabaseClient;

  constructor(private readonly config: WebPushConfig) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    this.client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }

  async notifyNewReport(report: TrafficReportDto): Promise<void> {
    if (report.status !== 'active') return;
    const { data, error } = await this.client.rpc('find_route_watchers', {
      p_report_id: report.id,
      p_corridor_m: ROUTE_CORRIDOR_METERS,
    });
    if (error) throw new Error(`find_route_watchers failed: ${error.code ?? ''} ${error.message ?? ''}`);
    const watchers = (data ?? []) as Watcher[];
    if (!watchers.length) return;

    const queue = [...watchers];
    const workers = Array.from({ length: Math.min(SEND_CONCURRENCY, queue.length) }, async () => {
      for (let watcher = queue.shift(); watcher; watcher = queue.shift()) await this.send(report, watcher);
    });
    await Promise.all(workers);
    console.info(
      JSON.stringify({ event: 'traffic_push_sent', reportId: report.id, recipients: watchers.length }),
    );
  }

  private async send(report: TrafficReportDto, watcher: Watcher): Promise<void> {
    // Kiểm tra lại ngay trước khi gửi: dữ liệu cũ (trước migration 0009) hoặc ghi thẳng vào DB không được tin.
    if (!isAllowedPushEndpoint(watcher.endpoint)) {
      console.warn('Web push endpoint rejected by policy');
      await this.client.rpc('delete_push_subscription', { p_endpoint: watcher.endpoint });
      return;
    }
    try {
      await webPush.sendNotification(
        { endpoint: watcher.endpoint, keys: { p256dh: watcher.p256dh, auth: watcher.auth } },
        JSON.stringify(trafficPushPayload(report, watcher)),
        {
          TTL: 15 * 60,
          urgency: 'high',
          topic: report.id.replace(/-/g, '').slice(0, 32),
          timeout: SEND_TIMEOUT_MS,
        },
      );
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.client.rpc('delete_push_subscription', { p_endpoint: watcher.endpoint });
        return;
      }
      console.warn('Web push delivery failed', { statusCode });
    }
  }
}
