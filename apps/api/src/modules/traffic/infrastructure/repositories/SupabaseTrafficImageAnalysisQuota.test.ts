import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClientFactory } from '../../../../shared/supabase/SupabaseClientFactory.js';
import { SupabaseTrafficImageAnalysisQuota } from './SupabaseTrafficImageAnalysisQuota.js';

function quotaWith(error: { code?: string; message?: string } | null | Error) {
  const rpc = vi.fn(async () => {
    if (error instanceof Error) throw error;
    return { error };
  });
  const create = vi.fn(() => ({ rpc }));
  const quota = new SupabaseTrafficImageAnalysisQuota({ create } as unknown as SupabaseClientFactory);
  return { quota, rpc, create };
}

describe('SupabaseTrafficImageAnalysisQuota', () => {
  it('gọi RPC consume_traffic_image_quota bằng JWT của người dùng', async () => {
    const { quota, rpc, create } = quotaWith(null);
    await expect(quota.consume('jwt')).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledWith('jwt');
    expect(rpc).toHaveBeenCalledWith('consume_traffic_image_quota');
  });

  it('đổi lỗi vượt hạn mức của Postgres thành 429', async () => {
    const { quota } = quotaWith({ code: 'P0001', message: 'TRAFFIC_IMAGE_RATE_LIMIT: Hourly quota reached' });
    await expect(quota.consume('jwt')).rejects.toMatchObject({
      statusCode: 429,
      code: 'TRAFFIC_IMAGE_RATE_LIMIT',
    });
  });

  it('đổi lỗi chưa xác thực thành 401', async () => {
    const { quota } = quotaWith({ code: '42501', message: 'Authentication required' });
    await expect(quota.consume('jwt')).rejects.toMatchObject({ statusCode: 401, code: 'AUTH_REQUIRED' });
  });

  it('báo 503 khi không kiểm tra được hạn mức (lỗi khác hoặc mất kết nối)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(quotaWith({ code: 'XX000', message: 'boom' }).quota.consume('jwt')).rejects.toMatchObject({
      statusCode: 503,
      code: 'TRAFFIC_IMAGE_QUOTA_UNAVAILABLE',
    });
    await expect(quotaWith(new Error('network')).quota.consume('jwt')).rejects.toMatchObject({
      statusCode: 503,
      code: 'TRAFFIC_IMAGE_QUOTA_UNAVAILABLE',
    });
  });
});
