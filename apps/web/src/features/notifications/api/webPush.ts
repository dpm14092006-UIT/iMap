import { httpClient } from '../../../shared/api/HttpClient';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import type { Coordinate, LatLng } from '../../../shared/geo/types';
import type { TransportMode } from '../../routing/types';
import { pendingPushCleanup } from '../services/pendingPushCleanup';

type PushConfig = { enabled: boolean; publicKey: string | null };

const SERVICE_WORKER_URL = '/sw.js';
/** Số điểm tối đa gửi lên server cho một tuyến (RPC upsert_route_watch giới hạn 500). */
const MAX_WATCH_POINTS = 400;

export function webPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

let configPromise: Promise<PushConfig> | null = null;
/** Khóa VAPID công khai từ API; API chưa cấu hình thì enabled = false. */
export function getPushConfig(): Promise<PushConfig> {
  configPromise ??= httpClient.get<PushConfig>('/push/config').catch(() => {
    configPromise = null;
    return { enabled: false, publicKey: null };
  });
  return configPromise;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (
      (await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)) ??
      (await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' }))
    );
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * Đăng ký Web Push cho trình duyệt này và lưu vào tài khoản (RPC save_push_subscription).
 * Gọi khi quyền thông báo đã là "granted". Trả endpoint, hoặc null nếu không làm được.
 */
export async function ensurePushSubscription(): Promise<string | null> {
  if (!webPushSupported() || Notification.permission !== 'granted') return null;
  const [config, registration, client] = await Promise.all([
    getPushConfig(),
    getServiceWorkerRegistration(),
    getSupabaseClient(),
  ]);
  if (!config.enabled || !config.publicKey || !registration || !client) return null;

  const applicationServerKey = urlBase64ToUint8Array(config.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  // Khóa VAPID đổi thì đăng ký cũ không nhận được push nữa: hủy và đăng ký lại.
  const currentKey = subscription?.options.applicationServerKey;
  if (
    subscription &&
    currentKey &&
    new Uint8Array(currentKey).toString() !== applicationServerKey.toString()
  ) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  const { error } = await client.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) throw new Error('Không lưu được đăng ký thông báo. Hãy thử lại sau.');
  // Server đã chuyển endpoint này sang tài khoản hiện tại (và xóa tuyến theo dõi của chủ cũ):
  // không còn gì của tài khoản trước cần dọn nữa.
  pendingPushCleanup.clear();
  return json.endpoint;
}

/** Rút gọn tuyến còn ≤ MAX_WATCH_POINTS điểm (lấy mẫu đều, giữ điểm đầu/cuối). */
export function simplifyPath(points: Coordinate[], maxPoints = MAX_WATCH_POINTS): Coordinate[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]!);
}

/** Báo cho server tuyến đang đi của trình duyệt này để nhận push khi có sự cố trên tuyến. */
export async function upsertRouteWatch(
  endpoint: string,
  vehicle: TransportMode,
  path: Coordinate[],
  location: LatLng | null,
): Promise<void> {
  const client = await getSupabaseClient();
  if (!client || path.length < 2) return;
  const { error } = await client.rpc('upsert_route_watch', {
    p_endpoint: endpoint,
    p_vehicle: vehicle,
    p_path: simplifyPath(path).map(([lat, lng]) => [Number(lat.toFixed(6)), Number(lng.toFixed(6))]),
    p_lat: location?.lat ?? null,
    p_lng: location?.lng ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Khi đăng xuất: gỡ đăng ký push của trình duyệt này để máy dùng chung không còn nhận cảnh báo tuyến của
 * người trước. Hai việc chạy song song, chỉ cần một việc thành công là đủ:
 * - xóa dòng của mình trong `push_subscriptions` (RLS cho phép; route_watches tự xóa theo on delete cascade)
 *   → server không còn gửi tới endpoint này;
 * - hủy đăng ký trong trình duyệt (không được thì gỡ luôn service worker) → endpoint chết hẳn.
 * Cả hai đều lỗi thì ghi nhớ endpoint để `retryPendingPushCleanup` dọn ở lần mở trang sau, và báo lỗi.
 * Đăng nhập lại thì ensurePushSubscription đăng ký mới.
 *
 * Tự đọc đăng ký từ service worker thay vì nhận endpoint từ state của App, để chạy được cả ở trang /login
 * (trang này không dựng App). Chỉ đọc đăng ký có sẵn, không đăng ký service worker mới.
 */
export async function deleteCurrentPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  const subscription = await registration?.pushManager.getSubscription();
  if (!registration || !subscription) return;
  const { endpoint } = subscription;
  // Ghi nhớ trước: tab bị đóng giữa chừng thì lần mở sau vẫn dọn tiếp.
  pendingPushCleanup.remember(endpoint);
  const [removedOnServer, stoppedInBrowser] = await Promise.all([
    removeServerSubscription(endpoint),
    stopBrowserPush(registration, subscription),
  ]);
  if (!removedOnServer && !stoppedInBrowser) {
    throw new Error('Không gỡ được đăng ký thông báo của tài khoản này trên máy.');
  }
  pendingPushCleanup.clear();
}

/**
 * Dọn đăng ký push mà lần đăng xuất trước chưa gỡ được. Chỉ gọi khi không có ai đăng nhập: lúc đó không
 * còn phiên để xóa trên Supabase, nên chỉ hủy được ở trình duyệt (vậy là đủ để endpoint chết hẳn).
 */
export async function retryPendingPushCleanup(): Promise<void> {
  const endpoint = pendingPushCleanup.get();
  if (!endpoint) return;
  if (!('serviceWorker' in navigator)) {
    pendingPushCleanup.clear();
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  const subscription = await registration?.pushManager.getSubscription();
  // Đăng ký đã mất hoặc đã đổi sang endpoint khác: không còn gì của tài khoản cũ.
  if (!registration || !subscription || subscription.endpoint !== endpoint) {
    pendingPushCleanup.clear();
    return;
  }
  if (await stopBrowserPush(registration, subscription)) pendingPushCleanup.clear();
}

/** Xóa đăng ký khỏi tài khoản. Supabase trả `{ error }` chứ không throw nên phải tự kiểm tra. */
async function removeServerSubscription(endpoint: string): Promise<boolean> {
  try {
    const client = await getSupabaseClient();
    // Không cấu hình Supabase thì cũng không có đăng ký nào được lưu trên server.
    if (!client) return true;
    const { error } = await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Hủy đăng ký push trong trình duyệt. `unsubscribe()` lỗi (hoặc trả false) thì gỡ service worker:
 * đăng ký push gắn với service worker nên mất theo; lần mở app sau sẽ tự đăng ký lại service worker.
 */
async function stopBrowserPush(
  registration: ServiceWorkerRegistration,
  subscription: PushSubscription,
): Promise<boolean> {
  if (await subscription.unsubscribe().catch(() => false)) return true;
  return registration.unregister().catch(() => false);
}

export async function deleteRouteWatch(endpoint: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await client.from('route_watches').delete().eq('endpoint', endpoint);
}
