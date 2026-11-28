import { useState, useSyncExternalStore } from 'react';
import type { MapLayer } from '../types';

export type MapLayerPreference = MapLayer | 'auto';
const STORAGE_KEY = 'imap-base-layer';
/** Giao diện tối từ 18:00 tới trước 6:00 sáng (giờ trên máy người dùng); ban ngày luôn sáng. */
export const DARK_FROM_HOUR = 18;
export const LIGHT_FROM_HOUR = 6;

export function isNightTime(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= DARK_FROM_HOUR || hour < LIGHT_FROM_HOUR;
}

/** Báo lại mỗi phút để đổi giao diện đúng 6:00 và 18:00 mà không cần tải lại trang. */
function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onChange);
  };
}

function readLayer(): MapLayerPreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === 'street' || value === 'dark' || value === 'satellite' || value === 'admin') return value;
  } catch {
    // Vẫn tự đổi theo giờ nếu trình duyệt không cung cấp bộ nhớ.
  }
  return 'auto';
}

export function resolveMapLayer(preference: MapLayerPreference, isDark: boolean): MapLayer {
  return preference === 'auto' ? (isDark ? 'dark' : 'street') : preference;
}

export function useNightTime() {
  return useSyncExternalStore(
    subscribe,
    () => isNightTime(),
    () => false,
  );
}

export function useMapAppearance() {
  const isDark = useNightTime();
  const [preference, setPreference] = useState(readLayer);
  return {
    isDark,
    preference,
    layer: resolveMapLayer(preference, isDark),
    setLayer(value: MapLayerPreference) {
      setPreference(value);
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Lựa chọn vẫn có hiệu lực trong phiên hiện tại.
      }
    },
  };
}
