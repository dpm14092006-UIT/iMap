import { useEffect, useState } from 'react';
import type { MapLayer } from '../types';

/** Tối từ 18:00 đến 06:00 sáng hôm sau (giờ địa phương của trình duyệt). */
export function scheduledMapLayer(now = new Date()): 'street' | 'dark' {
  return now.getHours() >= 18 || now.getHours() < 6 ? 'dark' : 'street';
}

export function nextMapThemeChange(now: Date): Date {
  const next = new Date(now);
  if (now.getHours() < 6) next.setHours(6, 0, 0, 0);
  else if (now.getHours() < 18) next.setHours(18, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }
  return next;
}

/**
 * Giao diện tối tự động theo giờ trên mọi kích thước màn hình; đồng bộ lại khi máy thức dậy
 * hoặc tab quay lại. Vệ tinh giữ ảnh vệ tinh nhưng phần giao diện vẫn theo lịch.
 */
export function useTimeBasedMapLayer() {
  const [theme, setTheme] = useState(scheduledMapLayer);
  const [satellite, setSatellite] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      const now = new Date();
      setTheme(scheduledMapLayer(now));
      timer = setTimeout(sync, nextMapThemeChange(now).getTime() - now.getTime());
    };
    sync();
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return {
    isDark: theme === 'dark',
    layer: satellite ? ('satellite' as const) : theme,
    setLayer: (layer: MapLayer) => setSatellite(layer === 'satellite'),
  };
}
