import { useCallback, useEffect, useState } from 'react';
import {
  ensurePushSubscription,
  getPushConfig,
  getServiceWorkerRegistration,
  webPushSupported,
} from '../services/webPush';

export type PushState = {
  /** Trình duyệt hỗ trợ Web Push (iPhone: chỉ khi đã "Thêm vào Màn hình chính"). */
  supported: boolean;
  /** API đã cấu hình khóa VAPID. */
  serverEnabled: boolean;
  permission: NotificationPermission | 'unsupported';
  /** Endpoint đã lưu vào tài khoản; null nếu chưa bật. */
  endpoint: string | null;
  busy: boolean;
  error: string;
};

/**
 * Quản lý quyền thông báo + đăng ký Web Push theo tài khoản đăng nhập.
 * Quyền đã cấp từ trước thì tự đăng ký lại mỗi lần đăng nhập, không hỏi lại.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const supported = webPushSupported();
  const [state, setState] = useState<PushState>(() => ({
    supported,
    serverEnabled: false,
    permission: supported ? Notification.permission : 'unsupported',
    endpoint: null,
    busy: false,
    error: '',
  }));

  useEffect(() => {
    if (!supported) return;
    let active = true;
    void getPushConfig().then((config) => {
      if (active) setState((current) => ({ ...current, serverEnabled: config.enabled }));
    });
    // Đăng ký service worker sớm để thông báo cục bộ (khi tab chạy nền) dùng được cả lúc chưa bật push.
    void getServiceWorkerRegistration();
    return () => {
      active = false;
    };
  }, [supported]);

  useEffect(() => {
    if (!supported || !isAuthenticated || Notification.permission !== 'granted') {
      if (!isAuthenticated) setState((current) => ({ ...current, endpoint: null }));
      return;
    }
    let active = true;
    void ensurePushSubscription()
      .then((endpoint) => {
        if (active) setState((current) => ({ ...current, endpoint, permission: Notification.permission }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [supported, isAuthenticated]);

  /** Gọi từ một cú bấm của người dùng (trình duyệt bắt buộc). */
  const enable = useCallback(async () => {
    if (!supported) return false;
    setState((current) => ({ ...current, busy: true, error: '' }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((current) => ({ ...current, permission, busy: false }));
        return false;
      }
      const endpoint = isAuthenticated ? await ensurePushSubscription() : null;
      setState((current) => ({ ...current, permission, endpoint, busy: false }));
      return true;
    } catch (cause) {
      setState((current) => ({
        ...current,
        busy: false,
        error: cause instanceof Error ? cause.message : 'Không bật được thông báo.',
      }));
      return false;
    }
  }, [supported, isAuthenticated]);

  return { ...state, enable };
}
