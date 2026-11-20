import { useEffect, useState } from 'react';

declare const __APP_BUILD_VERSION__: string;

const CHECK_INTERVAL_MS = 60_000;

type AppVersionResponse = { version?: unknown };

/**
 * Có nên hỏi máy chủ phiên bản mới không: không cần khi đã biết có bản mới (nút tải lại đang hiện),
 * và không hỏi khi tab đang ẩn (tốn mạng/pin, người dùng cũng không thấy thông báo).
 */
export function shouldCheckForUpdate(updateAvailable: boolean, visibility: DocumentVisibilityState): boolean {
  return !updateAvailable && visibility === 'visible';
}

/** Checks for a newer deployment and lets the user reload when ready. */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Đã có bản mới: thôi kiểm tra cho tới khi người dùng tải lại trang.
    if (updateAvailable) return;
    let active = true;

    const checkForUpdate = async () => {
      try {
        const response = await fetch(`/app-version.json?check=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;

        const latest = (await response.json()) as AppVersionResponse;
        if (active && typeof latest.version === 'string' && latest.version !== __APP_BUILD_VERSION__) {
          setUpdateAvailable(true);
        }
      } catch {
        // Keep the currently loaded app available while the user is offline.
      }
    };

    const checkWhenVisible = () => {
      if (shouldCheckForUpdate(false, document.visibilityState)) void checkForUpdate();
    };
    // Tab ẩn thì bỏ qua lượt định kỳ; khi quay lại tab sẽ kiểm tra ngay nhờ visibilitychange/focus.
    const intervalId = window.setInterval(checkWhenVisible, CHECK_INTERVAL_MS);

    window.addEventListener('focus', checkWhenVisible);
    document.addEventListener('visibilitychange', checkWhenVisible);
    checkWhenVisible();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkWhenVisible);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [updateAvailable]);

  return {
    updateAvailable,
    reloadForUpdate: () => window.location.reload(),
  };
}
