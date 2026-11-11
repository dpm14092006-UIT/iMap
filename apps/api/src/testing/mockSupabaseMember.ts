import { vi } from 'vitest';
import { SupabaseClientFactory } from '../shared/supabase/SupabaseClientFactory.js';

/**
 * Giả lập Supabase cho test HTTP: phiên `test-session` là thành viên hợp lệ,
 * RPC hạn mức cho phép `quotaPerMinute` lượt rồi báo FEATURE_RATE_LIMIT giống migration 0005.
 */
export function mockSupabaseMember(quotaPerMinute = 5) {
  let used = 0;
  const getUser = vi.fn(async (token: string) =>
    token === 'test-session'
      ? { data: { user: { id: 'member-1' } }, error: null }
      : { data: { user: null }, error: { status: 401 } },
  );
  const rpc = vi.fn(async (name: string) => {
    if (name !== 'consume_user_feature_quota') return { data: null, error: null };
    used += 1;
    return used > quotaPerMinute
      ? {
          data: null,
          error: { code: 'P0001', message: 'FEATURE_RATE_LIMIT: Per-user feature quota reached' },
        }
      : { data: null, error: null };
  });
  vi.spyOn(SupabaseClientFactory.prototype, 'create').mockReturnValue({
    auth: { getUser },
    rpc,
  } as unknown as ReturnType<SupabaseClientFactory['create']>);
  return { getUser, rpc };
}
