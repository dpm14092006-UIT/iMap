import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import { deleteCurrentPushSubscription } from './webPush';

vi.mock('../../auth/services/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(getSupabaseClient).mockReset();
});

/** Trình duyệt giả có (hoặc không có) đăng ký push sẵn trong service worker. */
function stubServiceWorker(subscription: { endpoint: string; unsubscribe: () => Promise<boolean> } | null) {
  const register = vi.fn();
  const getRegistration = vi
    .fn()
    .mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } });
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration, register } });
  return { register };
}

describe('deleteCurrentPushSubscription (review PR #11: đăng xuất ở /login)', () => {
  it('tự đọc đăng ký của trình duyệt, xóa khỏi tài khoản rồi hủy đăng ký — không cần state của App', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    stubServiceWorker({ endpoint: 'https://push.example/abc', unsubscribe });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ delete: () => ({ eq }) }));
    vi.mocked(getSupabaseClient).mockResolvedValue({ from } as never);

    await deleteCurrentPushSubscription();

    expect(from).toHaveBeenCalledWith('push_subscriptions');
    expect(eq).toHaveBeenCalledWith('endpoint', 'https://push.example/abc');
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('máy chưa bật push thì không làm gì và không đăng ký service worker mới', async () => {
    const { register } = stubServiceWorker(null);
    await deleteCurrentPushSubscription();
    expect(getSupabaseClient).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});
