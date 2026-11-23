import { lazy } from 'react';
import { timeoutSignal } from '../shared/api/timeoutSignal';

declare const __APP_BUILD_VERSION__: string;

/** A tab can outlive a deployment, leaving its unopened panels pointing at removed chunks. */
export async function loadWithRecovery<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    const timeout = timeoutSignal(3000);
    let reload = false;
    try {
      const response = await fetch(`/app-version.json?check=${Date.now()}`, {
        cache: 'no-store',
        signal: timeout.signal,
      });
      if (response.ok) {
        const latest: { version?: unknown } = await response.json();
        if (typeof latest.version === 'string' && latest.version !== __APP_BUILD_VERSION__) {
          const key = `imap.chunk-recovery.${__APP_BUILD_VERSION__}`;
          // Record before reloading. A broken deployment must never cause a reload loop.
          if (!window.sessionStorage.getItem(key)) {
            window.sessionStorage.setItem(key, '1');
            reload = true;
          }
        }
      }
    } catch {
      // Offline, unavailable storage or an invalid version response: keep the original error.
    } finally {
      timeout.dispose();
    }
    if (!reload) throw error;
    window.location.reload();
    // Keep Suspense mounted while the browser navigates instead of crashing the whole app.
    return new Promise<T>(() => {});
  }
}

export const lazyWithRecovery: typeof lazy = (load) => lazy(() => loadWithRecovery(load));
