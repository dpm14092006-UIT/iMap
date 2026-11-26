export type MapEngine = 'leaflet' | 'maplibre';

/**
 * Bộ máy bản đồ đang dùng. Trong lúc chuyển từ Leaflet sang MapLibre GL, mặc định lấy từ
 * `VITE_MAP_ENGINE` (chưa đặt = leaflet); thêm `?engine=maplibre` hoặc `?engine=leaflet` vào địa chỉ để thử.
 */
export function resolveMapEngine(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  configured: string | undefined = import.meta.env.VITE_MAP_ENGINE,
): MapEngine {
  const requested = new URLSearchParams(search).get('engine');
  if (requested === 'maplibre' || requested === 'leaflet') return requested;
  return configured === 'maplibre' ? 'maplibre' : 'leaflet';
}
