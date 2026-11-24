/* global self, URL, caches */
/* Service worker chỉ dùng cho Web Push cảnh báo giao thông trên tuyến. Không cache, không chặn fetch. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function parsePayload(event) {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
}

/*
 * Endpoint của tài khoản đã đăng xuất (trang ghi vào Cache Storage khi đăng xuất, xóa khi tài khoản mới
 * bật thông báo). GIỮ KHỚP với src/features/notifications/services/blockedPushEndpoint.ts.
 */
const PUSH_STATE_CACHE = 'imap-push-state';
const BLOCKED_ENDPOINT_KEY = '/__imap/push-blocked-endpoint';

/** Bỏ qua cảnh báo nếu đăng ký đã bị chặn hoặc không xác minh được trạng thái chặn. */
async function suppressBlockedPush() {
  try {
    const cache = await caches.open(PUSH_STATE_CACHE);
    const stored = await cache.match(BLOCKED_ENDPOINT_KEY);
    if (!stored) return false;
    const blocked = await stored.text();
    if (!blocked) return false;
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription && subscription.endpoint !== blocked) return false;
    // Chỉ hủy đăng ký vừa đối chiếu với dấu chặn, kể cả khi trang đã đóng.
    await subscription?.unsubscribe();
    return true;
  } catch {
    return true;
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event);
  if (!payload || payload.type !== 'traffic_report' || !payload.report) return;

  event.waitUntil(
    (async () => {
      if (await suppressBlockedPush()) return;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Báo cho mọi tab đang mở để app hiện banner + hỏi đổi tuyến ngay.
      for (const client of windows) client.postMessage({ type: 'traffic_alert', report: payload.report });
      // Tab đang hiển thị thì app tự kêu/rung và hiện banner lớn; còn lại phải có thông báo hệ thống.
      const visible = windows.some((client) => client.visibilityState === 'visible' && client.focused);
      if (visible) return;
      await self.registration.showNotification(payload.title || 'Cảnh báo giao thông trên tuyến', {
        body: payload.body || '',
        tag: payload.tag || `traffic-${payload.report.id}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 120, 300, 120, 300],
        icon: '/apple-touch-icon.png',
        badge: '/favicon-32.png',
        data: { report: payload.report },
        actions: [
          { action: 'reroute', title: 'Xem đường khác' },
          { action: 'dismiss', title: 'Bỏ qua' },
        ],
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  notification.close();
  if (event.action === 'dismiss') return;
  const report = notification.data && notification.data.report;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if (report) existing.postMessage({ type: 'traffic_alert', report, opened: true });
        return;
      }
      await self.clients.openWindow('/');
    })(),
  );
});
