import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from './pushEndpointPolicy.js';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMH',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
    'https://fcm.googleapis.com:443/fcm/send/abc',
    'https://FCM.GoogleAPIs.com/fcm/send/abc',
  ])('cho phép dịch vụ push thật: %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ['http (không mã hóa)', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['IP nội bộ', 'https://127.0.0.1/hook'],
    ['IP metadata cloud', 'https://169.254.169.254/latest/meta-data'],
    ['IPv6 loopback', 'https://[::1]/x'],
    ['host tự chọn', 'https://attacker.example/collect'],
    ['cổng lạ', 'https://fcm.googleapis.com:8443/fcm/send/abc'],
    ['userinfo đánh lừa host', 'https://fcm.googleapis.com@attacker.example/x'],
    ['hậu tố giả', 'https://evilpush.apple.com.attacker.example/x'],
    ['chỉ có hậu tố', 'https://push.apple.com/x'],
    ['tên gần giống', 'https://fcm.googleapis.com.evil.io/x'],
    ['không phải URL', 'not a url'],
    ['quá dài', `https://fcm.googleapis.com/${'a'.repeat(2100)}`],
  ])('từ chối %s', (_label, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});
