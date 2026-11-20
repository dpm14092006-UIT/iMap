import { useEffect } from 'react';
import { useAuth } from '../../auth/context/AuthProvider';
import { deleteCurrentPushSubscription } from '../api/webPush';

/**
 * Đăng xuất ở bất kỳ trang nào (trang chính hay /login): gỡ đăng ký push của máy này trước khi mất phiên,
 * nếu không server vẫn gửi cảnh báo tuyến của tài khoản cũ cho người dùng tiếp theo trên máy dùng chung.
 * Đặt ngay dưới AuthProvider trong main.tsx; không hiển thị gì.
 */
export function PushSignOutCleanup() {
  const { onBeforeSignOut } = useAuth();
  useEffect(() => onBeforeSignOut(deleteCurrentPushSubscription), [onBeforeSignOut]);
  return null;
}
