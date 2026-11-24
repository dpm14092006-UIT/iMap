/**
 * Endpoint push của tài khoản vừa đăng xuất, lưu trong Cache Storage để service worker (public/sw.js) đọc
 * được: service worker không truy cập localStorage. Khi có push tới endpoint này, service worker bỏ qua,
 * không hiện thông báo hay chuyển cảnh báo cho tab. Vậy máy dùng chung không lộ cảnh báo của người trước
 * ngay cả khi việc gỡ đăng ký (Supabase + trình duyệt) chưa xong hoặc thất bại.
 *
 * GIỮ KHỚP tên cache và khóa với PUSH_STATE_CACHE / BLOCKED_ENDPOINT_KEY trong public/sw.js.
 */
export const PUSH_STATE_CACHE = 'imap-push-state';
export const BLOCKED_ENDPOINT_KEY = '/__imap/push-blocked-endpoint';

/** Cache Storage chỉ có trong ngữ cảnh bảo mật; không có thì bỏ qua (cũng không có Web Push). */
async function openPushState(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(PUSH_STATE_CACHE);
  } catch {
    return null;
  }
}

/** Chặn hiển thị push tới `endpoint` (gọi đầu tiên khi đăng xuất, trước mọi bước có thể lỗi). */
export async function blockPushEndpoint(endpoint: string): Promise<void> {
  const cache = await openPushState();
  await cache?.put(BLOCKED_ENDPOINT_KEY, new Response(endpoint)).catch(() => undefined);
}

/** Bỏ chặn: server đã gán endpoint cho tài khoản đang đăng nhập (ensurePushSubscription lưu thành công). */
export async function clearBlockedPushEndpoint(): Promise<void> {
  const cache = await openPushState();
  await cache?.delete(BLOCKED_ENDPOINT_KEY).catch(() => undefined);
}
