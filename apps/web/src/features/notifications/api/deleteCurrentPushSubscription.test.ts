import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import { pendingPushCleanup } from '../services/pendingPushCleanup';
import { deleteCurrentPushSubscription, retryPendingPushCleanup } from './webPush';

vi.mock('../../auth/services/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

const ENDPOINT = 'https://push.example/abc';

beforeEach(() => {
  // localStorage giả trong bộ nhớ (môi trường test là Node, không có Web Storage).
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(getSupabaseClient).mockReset();
});

type FakeSubscription = { endpoint: string; unsubscribe: () => Promise<boolean> };

/** Trình duyệt giả có (hoặc không có) đăng ký push sẵn trong service worker. */
function stubServiceWorker(
  subscription: FakeSubscription | null,
  unregister: () => Promise<boolean> = vi.fn().mockResolvedValue(true),
) {
  const register = vi.fn();
  const getRegistration = vi.fn().mockResolvedValue({
    unregister,
    pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
  });
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration, register } });
  return { register, unregister };
}

/** Supabase giả: lần xóa trả về `result` (Supabase trả `{ error }` chứ không throw). */
function stubSupabaseDelete(result: { error: unknown } | Error) {
  const eq = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => ({ delete: () => ({ eq }) }));
  vi.mocked(getSupabaseClient).mockResolvedValue({ from } as never);
  return { from, eq };
}

describe('deleteCurrentPushSubscription (review PR #11: đăng xuất ở /login)', () => {
  it('tự đọc đăng ký của trình duyệt, xóa khỏi tài khoản rồi hủy đăng ký — không cần state của App', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    stubServiceWorker({ endpoint: ENDPOINT, unsubscribe });
    const { from, eq } = stubSupabaseDelete({ error: null });

    await deleteCurrentPushSubscription();

    expect(from).toHaveBeenCalledWith('push_subscriptions');
    expect(eq).toHaveBeenCalledWith('endpoint', ENDPOINT);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(pendingPushCleanup.get()).toBeNull();
  });

  it('máy chưa bật push thì không làm gì và không đăng ký service worker mới', async () => {
    const { register } = stubServiceWorker(null);
    await deleteCurrentPushSubscription();
    expect(getSupabaseClient).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});

describe('deleteCurrentPushSubscription khi một bước lỗi (issue #19, mục 8)', () => {
  it('Supabase lỗi và hủy đăng ký lỗi: gỡ service worker để đăng ký push mất theo', async () => {
    const unsubscribe = vi.fn().mockRejectedValue(new Error('InvalidStateError'));
    const { unregister } = stubServiceWorker({ endpoint: ENDPOINT, unsubscribe });
    stubSupabaseDelete({ error: { message: 'network' } });

    await expect(deleteCurrentPushSubscription()).resolves.toBeUndefined();

    expect(unregister).toHaveBeenCalledOnce();
    expect(pendingPushCleanup.get()).toBeNull();
  });

  it('mọi bước đều lỗi: báo lỗi và ghi nhớ endpoint để dọn ở lần mở trang sau', async () => {
    stubServiceWorker(
      { endpoint: ENDPOINT, unsubscribe: vi.fn().mockResolvedValue(false) },
      vi.fn().mockRejectedValue(new Error('unregister failed')),
    );
    stubSupabaseDelete({ error: { message: 'network' } });

    await expect(deleteCurrentPushSubscription()).rejects.toThrow();

    expect(pendingPushCleanup.get()).toBe(ENDPOINT);
  });

  it('Supabase mất mạng (throw) nhưng trình duyệt hủy được: vẫn coi là đã gỡ xong', async () => {
    stubServiceWorker({ endpoint: ENDPOINT, unsubscribe: vi.fn().mockResolvedValue(true) });
    stubSupabaseDelete(new Error('Failed to fetch'));

    await expect(deleteCurrentPushSubscription()).resolves.toBeUndefined();
    expect(pendingPushCleanup.get()).toBeNull();
  });

  it('đã xóa trên server nhưng trình duyệt không hủy được: server không còn gửi, không cần dọn lại', async () => {
    stubServiceWorker(
      { endpoint: ENDPOINT, unsubscribe: vi.fn().mockResolvedValue(false) },
      vi.fn().mockResolvedValue(false),
    );
    stubSupabaseDelete({ error: null });

    await expect(deleteCurrentPushSubscription()).resolves.toBeUndefined();
    expect(pendingPushCleanup.get()).toBeNull();
  });
});

describe('retryPendingPushCleanup', () => {
  it('lần mở sau: hủy đăng ký còn sót của tài khoản cũ rồi xóa dấu', async () => {
    pendingPushCleanup.remember(ENDPOINT);
    const unsubscribe = vi.fn().mockResolvedValue(true);
    stubServiceWorker({ endpoint: ENDPOINT, unsubscribe });

    await retryPendingPushCleanup();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(pendingPushCleanup.get()).toBeNull();
  });

  it('vẫn chưa hủy được thì giữ dấu để thử lại lần sau', async () => {
    pendingPushCleanup.remember(ENDPOINT);
    stubServiceWorker(
      { endpoint: ENDPOINT, unsubscribe: vi.fn().mockResolvedValue(false) },
      vi.fn().mockResolvedValue(false),
    );

    await retryPendingPushCleanup();

    expect(pendingPushCleanup.get()).toBe(ENDPOINT);
  });

  it('đăng ký đã đổi sang endpoint khác: không hủy nhầm, chỉ xóa dấu', async () => {
    pendingPushCleanup.remember(ENDPOINT);
    const unsubscribe = vi.fn().mockResolvedValue(true);
    stubServiceWorker({ endpoint: 'https://push.example/new', unsubscribe });

    await retryPendingPushCleanup();

    expect(unsubscribe).not.toHaveBeenCalled();
    expect(pendingPushCleanup.get()).toBeNull();
  });

  it('không có dấu thì không đọc service worker', async () => {
    const getRegistration = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration } });
    await retryPendingPushCleanup();
    expect(getRegistration).not.toHaveBeenCalled();
  });
});
