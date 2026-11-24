import { useEffect } from 'react';
import { useAuth } from '../../auth/context/AuthProvider';
import { deleteCurrentPushSubscription, retryPendingPushCleanup } from '../api/webPush';

/**
 * Đăng xuất ở bất kỳ trang nào (trang chính hay /login): gỡ đăng ký push của máy này trước khi mất phiên,
 * nếu không server vẫn gửi cảnh báo tuyến của tài khoản cũ cho người dùng tiếp theo trên máy dùng chung.
 * Lần đăng xuất trước chưa gỡ được (mạng và trình duyệt cùng lỗi) thì dọn tiếp khi không có ai đăng nhập.
 * Đặt ngay dưới AuthProvider trong main.tsx; không hiển thị gì.
 */
export function PushSignOutCleanup() {
  const { user, loading, onBeforeSignOut } = useAuth();
  useEffect(() => onBeforeSignOut(deleteCurrentPushSubscription), [onBeforeSignOut]);

  const signedOut = !loading && !user;
  useEffect(() => {
    if (signedOut) void retryPendingPushCleanup().catch(() => undefined);
  }, [signedOut]);

  return null;
}
