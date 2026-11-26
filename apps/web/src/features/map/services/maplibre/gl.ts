import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url&no-inline';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Coordinate, LatLng } from '../../../../shared/geo/types';

// Bản CSP-safe của worker (không dùng blob: eval), cùng cấu hình với bản Leaflet trước đây.
maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
export type GLMap = maplibregl.Map;

/** Khung nhìn khởi đầu toàn Việt Nam: [kinh độ, vĩ độ]. */
export const VIETNAM_CENTER_LNGLAT: [number, number] = [108, 16];

/** Tài nguyên Vietmap (style, ô, font) đi qua proxy của API iMap để giữ khóa ở máy chủ. */
const VIETMAP_RESOURCES = 'https://maps.vietmap.vn/maps/';

export function vietmapProxyBase(): URL {
  const api = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  return new URL(`${api}/map/vietmap/`, window.location.origin);
}

/** Dùng cho `transformRequest` của mọi map: chỉ đổi đường dẫn Vietmap, các nguồn khác giữ nguyên. */
export function transformMapRequest(url: string): { url: string } {
  return url.startsWith(VIETMAP_RESOURCES)
    ? { url: vietmapProxyBase().href + url.slice(VIETMAP_RESOURCES.length) }
    : { url };
}

export const toLngLat = (point: LatLng): [number, number] => [point.lng, point.lat];
/** Tọa độ nội bộ [vĩ độ, kinh độ] → [kinh độ, vĩ độ] của GeoJSON/MapLibre. */
export const coordinateToLngLat = ([lat, lng]: Coordinate): [number, number] => [lng, lat];

/** Tạo element bằng textContent (không dùng innerHTML) để tránh chèn HTML từ dữ liệu người dùng. */
export function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

/** Chú thích tên khi rê chuột (thay tooltip của Leaflet): chỉ CSS, không cần thư viện. */
export function withTooltip(element: HTMLElement, text: string): HTMLElement {
  const tip = textElement('span', text);
  tip.className = 'routetwin-tooltip routetwin-tooltip--hover';
  element.append(tip);
  return element;
}

type FeatureCollection = GeoJSON.FeatureCollection;
export const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Nguồn GeoJSON mà iMap tự vẽ. Đổi nền bằng `setStyle` xóa mọi nguồn/lớp: lớp này giữ dữ liệu cuối cùng
 * và cài lại khi style mới sẵn sàng (xem MaplibreMapController.reinstall).
 */
export class OverlaySource {
  private data: FeatureCollection = EMPTY_COLLECTION;

  constructor(
    private readonly map: GLMap,
    readonly id: string,
    private readonly options: { lineMetrics?: boolean } = {},
  ) {}

  install() {
    if (this.map.getSource(this.id)) return;
    this.map.addSource(this.id, { type: 'geojson', data: this.data, lineMetrics: this.options.lineMetrics });
  }

  set(data: FeatureCollection) {
    this.data = data;
    const source = this.map.getSource(this.id) as maplibregl.GeoJSONSource | undefined;
    source?.setData(data);
  }

  clear() {
    this.set(EMPTY_COLLECTION);
  }
}

/** Thêm lớp nếu chưa có (cài lại sau khi đổi nền). */
export function ensureLayer(map: GLMap, layer: maplibregl.AddLayerObject) {
  if (!map.getLayer(layer.id)) map.addLayer(layer);
}
