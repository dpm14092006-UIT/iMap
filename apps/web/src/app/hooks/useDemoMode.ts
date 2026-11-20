import { useCallback, useState } from 'react';

const STORAGE_KEY = 'imap.demoMode';

/**
 * Chế độ Demo (GPS giả): bật/tắt bằng nút "Demo" trên thanh trên, được nhớ trên thiết bị này.
 * Vẫn hỗ trợ link `?demo=1` (bật) và `?demo=0` (tắt) như trước.
 *
 * Mục đích: ngồi ở nhà vẫn chọn tuyến ở nơi khác, cho xe giả chạy dọc tuyến
 * và nhận cảnh báo kẹt xe / sự cố mà người dùng khác báo trên tuyến đó.
 */
export function isDemoModeEnabled(search: string = window.location.search): boolean {
  const fromUrl = new URLSearchParams(search).get('demo');
  if (fromUrl === '1' || fromUrl === '0') {
    writeStored(fromUrl === '1');
    return fromUrl === '1';
  }
  return readStored();
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ: vẫn bật/tắt được trong phiên hiện tại.
  }
}

/** Trạng thái Demo bật/tắt được ngay trên giao diện. */
export function useDemoMode() {
  const [enabled, setEnabledState] = useState(() => isDemoModeEnabled());
  const setEnabled = useCallback((next: boolean) => {
    writeStored(next);
    setEnabledState(next);
  }, []);
  return { enabled, setEnabled };
}
