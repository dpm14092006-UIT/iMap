import type { TrafficReportDto } from '@routetwin/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.fn();
const rpc = vi.fn();
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));

const { WebPushTrafficAlertNotifier } = await import('./WebPushTrafficAlertNotifier.js');

const report: TrafficReportDto = {
  id: '00000000-0000-4000-8000-000000000001',
  incidentType: 'accident',
  severity: 'high',
  vehicleScope: 'both',
  lat: 10.77,
  lng: 106.7,
  status: 'active',
  createdAt: '2026-11-20T08:00:00.000Z',
};
const watcher = (endpoint: string) => ({
  endpoint,
  p256dh: 'key',
  auth: 'secret',
  community_report_count: 1,
  community_reporter_count: 1,
  community_updated_at: null,
});

function notifier() {
  return new WebPushTrafficAlertNotifier({
    supabaseUrl: 'https://example.supabase.co',
    supabaseSecretKey: 'service',
    publicKey: 'public',
    privateKey: 'private',
    subject: 'mailto:ops@example.com',
  });
}

describe('WebPushTrafficAlertNotifier', () => {
  beforeEach(() => {
    sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
    rpc.mockReset();
  });

  it('chỉ gửi tới dịch vụ push hợp lệ; endpoint ngoài chính sách bị xóa mà không phát request', async () => {
    const allowed = 'https://fcm.googleapis.com/fcm/send/abc';
    const hostile = ['https://169.254.169.254/latest/meta-data', 'https://attacker.example/x'];
    rpc.mockImplementation(async (name: string) =>
      name === 'find_route_watchers'
        ? { data: [watcher(allowed), ...hostile.map(watcher)], error: null }
        : { data: null, error: null },
    );

    await notifier().notifyNewReport(report);

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0]![0]).toMatchObject({ endpoint: allowed });
    expect(sendNotification.mock.calls[0]![2]).toMatchObject({ timeout: 10_000 });
    for (const endpoint of hostile) {
      expect(rpc).toHaveBeenCalledWith('delete_push_subscription', { p_endpoint: endpoint });
    }
  });

  it('xóa đăng ký đã hết hạn (410) và không ném lỗi khi gửi thất bại', async () => {
    const endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/x';
    rpc.mockImplementation(async (name: string) =>
      name === 'find_route_watchers'
        ? { data: [watcher(endpoint)], error: null }
        : { data: null, error: null },
    );
    sendNotification.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    await expect(notifier().notifyNewReport(report)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('delete_push_subscription', { p_endpoint: endpoint });
  });

  it('bỏ qua báo cáo không còn hoạt động', async () => {
    await notifier().notifyNewReport({ ...report, status: 'cleared' });
    expect(rpc).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
