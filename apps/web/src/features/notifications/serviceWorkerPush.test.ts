import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient } from '../auth/services/supabaseClient';
import {
  deleteCurrentPushSubscription,
  ensurePushSubscription,
  retryPendingPushCleanup,
} from './api/webPush';

vi.mock('../auth/services/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));
vi.mock('../../shared/api/HttpClient', () => ({
  httpClient: { get: vi.fn(async () => ({ enabled: true, publicKey: 'AQID' })) },
}));

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/shared-device';
const SW_SOURCE = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8');
const PAYLOAD = {
  type: 'traffic_report',
  title: 'Kẹt xe trên tuyến của bạn',
  body: 'Tuyến của tài khoản cũ',
  report: { id: 'report-1', lat: 10.77, lng: 106.7 },
};

/** Cache Storage giả, dùng chung cho trang và service worker như trên trình duyệt thật. */
function fakeCaches() {
  const stores = new Map<string, Map<string, string>>();
  return {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, string>();
      stores.set(name, store);
      return {
        put: async (key: string, response: Response) => void store.set(key, await response.text()),
        match: async (key: string) => (store.has(key) ? new Response(store.get(key)) : undefined),
        delete: async (key: string) => store.delete(key),
      };
    },
  };
}

/** Trình duyệt giả: một đăng ký push mà mọi cách gỡ đều thất bại. */
function stubBrowser() {
  const subscription = {
    endpoint: ENDPOINT,
    options: { applicationServerKey: null },
    unsubscribe: vi.fn(async () => false),
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p256dh', auth: 'auth' } }),
  };
  const registration = {
    pushManager: { getSubscription: vi.fn(async () => subscription), subscribe: vi.fn() },
    unregister: vi.fn(async () => false),
    showNotification: vi.fn(async () => undefined),
  };
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  });
  vi.stubGlobal('caches', fakeCaches());
  vi.stubGlobal('navigator', {
    serviceWorker: { getRegistration: vi.fn(async () => registration), register: vi.fn() },
  });
  vi.stubGlobal('window', { isSecureContext: true, PushManager: {}, Notification: {} });
  vi.stubGlobal('Notification', { permission: 'granted' });
  return { subscription, registration };
}

/** Chạy public/sw.js thật với `self` giả; trả hàm phát một sự kiện push và chờ handler xong. */
function loadServiceWorker(registration: ReturnType<typeof stubBrowser>['registration']) {
  const listeners = new Map<string, (event: unknown) => void>();
  const tab = { postMessage: vi.fn(), visibilityState: 'hidden', focused: false };
  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    registration,
    clients: { matchAll: vi.fn(async () => [tab]) },
    location: { origin: 'https://imap.test' },
  };
  vm.runInNewContext(SW_SOURCE, { self, caches: globalThis.caches, URL, Response });
  return {
    tab,
    async push(payload: unknown) {
      const pending: Promise<unknown>[] = [];
      listeners.get('push')!({
        data: { json: () => payload },
        waitUntil: (p: Promise<unknown>) => pending.push(p),
      });
      await Promise.all(pending);
    },
  };
}

/** Supabase giả: xóa đăng ký lỗi; lưu đăng ký (tài khoản mới bật thông báo) thành công. */
function stubSupabase() {
  const eq = vi.fn(async () => ({ error: { message: 'network' } }));
  const rpc = vi.fn(async () => ({ error: null }));
  vi.mocked(getSupabaseClient).mockResolvedValue({ from: () => ({ delete: () => ({ eq }) }), rpc } as never);
  return { rpc };
}

beforeEach(() => vi.mocked(getSupabaseClient).mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('service worker sau khi đăng xuất (issue #21)', () => {
  it('mọi bước gỡ đăng ký đều lỗi: không hiện, không chuyển cảnh báo của tài khoản cũ', async () => {
    const { subscription, registration } = stubBrowser();
    stubSupabase();
    await expect(deleteCurrentPushSubscription()).rejects.toThrow();
    await retryPendingPushCleanup(); // lần dọn lại cũng thất bại
    const worker = loadServiceWorker(registration);

    await worker.push(PAYLOAD);

    expect(registration.showNotification).not.toHaveBeenCalled();
    expect(worker.tab.postMessage).not.toHaveBeenCalled();
    // Service worker tự thử hủy đăng ký thêm lần nữa.
    expect(subscription.unsubscribe.mock.calls.length).toBeGreaterThan(2);
  });

  it('tài khoản mới bật Web Push trên cùng máy: cảnh báo của tài khoản mới hiện bình thường', async () => {
    const { registration } = stubBrowser();
    const { rpc } = stubSupabase();
    await expect(deleteCurrentPushSubscription()).rejects.toThrow();

    // Server gán lại endpoint cho tài khoản mới (save_push_subscription) nên bỏ chặn.
    await expect(ensurePushSubscription()).resolves.toBe(ENDPOINT);
    expect(rpc).toHaveBeenCalledWith('save_push_subscription', expect.anything());
    const worker = loadServiceWorker(registration);

    await worker.push(PAYLOAD);

    expect(worker.tab.postMessage).toHaveBeenCalledOnce();
    expect(registration.showNotification).toHaveBeenCalledWith(PAYLOAD.title, expect.anything());
  });

  it('chưa từng đăng xuất: service worker hiện cảnh báo như cũ', async () => {
    const { registration } = stubBrowser();
    const worker = loadServiceWorker(registration);
    await worker.push(PAYLOAD);
    expect(registration.showNotification).toHaveBeenCalledOnce();
  });
});
