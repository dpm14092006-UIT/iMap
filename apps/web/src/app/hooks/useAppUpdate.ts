import { useEffect, useState } from 'react';

declare const __APP_BUILD_VERSION__: string;

const CHECK_INTERVAL_MS = 60_000;

type AppVersionResponse = { version?: unknown };

/** Checks for a newer deployment and lets the user reload when ready. */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
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
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    const intervalId = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);

    window.addEventListener('focus', checkWhenVisible);
    document.addEventListener('visibilitychange', checkWhenVisible);
    void checkForUpdate();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkWhenVisible);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, []);

  return {
    updateAvailable,
    reloadForUpdate: () => window.location.reload(),
  };
}
