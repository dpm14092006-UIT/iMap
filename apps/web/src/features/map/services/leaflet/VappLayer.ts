import type { Map } from 'leaflet';
import { MaplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url&no-inline';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BasemapProvider } from '../../basemap/providers';

/**
 * Bản đồ nền vApp (map.vapp.vn): hiển thị miễn phí, không cần khóa, không tính lượt.
 * Dùng NGUYÊN style chính thức: không ẩn, không đổi màu lớp nào (kể cả lớp chủ quyền sov-*),
 * vì điều khoản chưa nói rõ quyền tự đổi style (IMAP V2 §10). Ghi nguồn bắt buộc lấy từ registry.
 */
export const VAPP_ORIGIN = 'https://map.vapp.vn';

setWorkerUrl(workerUrl);

class VappGLLayer extends MaplibreGL {
  override onRemove(map: Map) {
    if (this.getMaplibreMap()) super.onRemove(map);
    // GL có thể lỗi khi khởi tạo (ví dụ máy không có WebGL) sau khi plugin đã chèn container.
    else this.getContainer()?.remove();
    return this;
  }
}

/** Tải style vApp rồi gắn vào Leaflet. Lỗi tải style/ô → `onUnavailable`. */
export async function addVappLayer(
  map: Map,
  provider: BasemapProvider,
  onUnavailable: () => void,
  request: typeof fetch = fetch,
): Promise<VappGLLayer> {
  if (!provider.url.startsWith(`${VAPP_ORIGIN}/`)) throw new Error('Nguồn vApp không hợp lệ');
  const response = await request(provider.url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`vApp style HTTP ${response.status}`);
  const style = (await response.json()) as StyleSpecification;
  const base = new VappGLLayer({
    style,
    attributionControl: { customAttribution: provider.attribution },
    interactive: false,
  });
  try {
    base.addTo(map);
    const gl = base.getMaplibreMap();
    let loaded = false;
    gl.once('load', () => {
      loaded = true;
    });
    gl.on('error', ({ error }) => {
      const status = 'status' in error ? Number(error.status) : undefined;
      // Ô lẻ 404 (vùng biển trống) là bình thường; lỗi trước khi tải xong hay lỗi máy chủ thì chuyển nguồn.
      if ((status !== undefined && status >= 429) || (!loaded && status !== 404))
        queueMicrotask(onUnavailable);
    });
    gl.on('webglcontextlost', () => queueMicrotask(onUnavailable));
  } catch (error) {
    if (map.hasLayer(base)) map.removeLayer(base);
    throw error;
  }
  return base;
}
