import { useEffect, useState } from 'react';
import type { MapLayer } from '../types';

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

/** Browser local time; re-sync when returning from sleep or a background tab. */
export function useTimeBasedMapLayer() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [theme, setTheme] = useState(scheduledMapLayer);
  const [satellite, setSatellite] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setMobile(media.matches);
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);
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
    automatic: mobile,
    layer: satellite ? ('satellite' as const) : mobile ? theme : ('street' as const),
    setLayer: (layer: MapLayer) => setSatellite(layer === 'satellite'),
  };
}
