/**
 * Chính sách đích gửi Web Push (chống SSRF).
 *
 * Endpoint do trình duyệt cấp luôn thuộc dịch vụ push của nhà cung cấp trình duyệt. Server chỉ gửi tới các
 * host đó qua HTTPS cổng 443; mọi URL khác (IP, mạng nội bộ, cổng lạ, có userinfo) bị từ chối để một tài khoản
 * không thể lưu endpoint tự chọn rồi khiến server gọi tới đích bất kỳ.
 * Giữ đồng bộ với `save_push_subscription` (supabase/migrations/0009_push_endpoint_allowlist.sql).
 */
const EXACT_HOSTS = new Set(['fcm.googleapis.com']);
const HOST_SUFFIXES = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];
const MAX_ENDPOINT_LENGTH = 2048;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port !== '' && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}
