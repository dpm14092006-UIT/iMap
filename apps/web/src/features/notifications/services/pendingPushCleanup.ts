/**
 * Ghi nhớ đăng ký push của tài khoản cũ chưa gỡ được khi đăng xuất (Supabase lỗi và trình duyệt cũng
 * không hủy được), để lần mở trang sau dọn tiếp. Nếu không, máy dùng chung vẫn nhận cảnh báo của
 * người trước cho tới khi có ai bật lại thông báo.
 *
 * Lưu trong localStorage; bị chặn (chế độ riêng tư) thì bỏ qua, không làm hỏng việc đăng xuất.
 */
const STORAGE_KEY = 'imap.push.pendingCleanup';

export const pendingPushCleanup = {
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  remember(endpoint: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, endpoint);
    } catch {
      // Không lưu được thì chỉ mất lượt dọn lại ở lần sau.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Như trên.
    }
  },
};
