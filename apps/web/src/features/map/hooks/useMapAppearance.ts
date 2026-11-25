import { useState, useSyncExternalStore } from 'react';
import type { MapLayer } from '../types';

export type MapLayerPreference = MapLayer | 'auto';
const SYSTEM_DARK = '(prefers-color-scheme: dark)';
const STORAGE_KEY = 'imap-base-layer';

export function systemPrefersDark() {
  return typeof window !== 'undefined' && (window.matchMedia?.(SYSTEM_DARK)?.matches ?? false);
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(SYSTEM_DARK);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

function readLayer(): MapLayerPreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === 'street' || value === 'dark' || value === 'satellite') return value;
  } catch {
    // Vẫn bật theo hệ thống nếu trình duyệt không cung cấp bộ nhớ.
  }
  return 'auto';
}

export function resolveMapLayer(preference: MapLayerPreference, isDark: boolean): MapLayer {
  return preference === 'auto' ? (isDark ? 'dark' : 'street') : preference;
}

export function useSystemDark() {
  return useSyncExternalStore(subscribe, systemPrefersDark, () => false);
}

export function useMapAppearance() {
  const isDark = useSystemDark();
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
