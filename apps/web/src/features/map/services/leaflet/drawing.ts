import * as L from 'leaflet';
import type { Coordinate } from '../../../../shared/geo/types';
import type { TrafficSeverity } from '../../../traffic/domain/trafficMapLayer';

/** Khung nhìn khởi đầu toàn Việt Nam, không giới hạn pan/zoom vào một thành phố. */
export const VIETNAM_CENTER: L.LatLngExpression = [16, 108];

export const COLORS = {
  start: '#0d9488',
  end: '#4338ca',
  routeFrom: [0x43, 0x38, 0xca],
  routeTo: [0x0d, 0x94, 0x88],
  alternative: '#a5b4fc',
};

/** Mức sự cố → màu giao thông (cùng bảng màu với chú giải: vàng / đỏ / đỏ sẫm). */
export const SEVERITY_COLORS: Record<TrafficSeverity, string> = {
  low: '#facc15',
  medium: '#ef4444',
  high: '#991b1b',
};

/** Nét bo tròn hai đầu và chỗ gấp, dùng cho mọi đường vẽ trên bản đồ. */
export const ROUND = { lineCap: 'round', lineJoin: 'round' } as const;

/** Dưới ngưỡng này (px) là điện thoại: nhãn tuyến rút gọn, chừa chỗ cho bảng kéo ở đáy. */
export const MOBILE_QUERY = '(max-width: 767px)';

export const toLatLngs = (points: Coordinate[]) => points.map(([lat, lng]) => L.latLng(lat, lng));

/** Tạo element bằng textContent (không dùng innerHTML) để tránh chèn HTML từ dữ liệu người dùng. */
export function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

/** Viền trắng dày bên dưới để tuyến (hoặc đoạn sự cố) nổi trên mọi nền bản đồ. */
export function drawWhiteCasing(points: L.LatLngExpression[], layer: L.LayerGroup) {
  L.polyline(points, { ...ROUND, color: '#fff', weight: 10, opacity: 0.94, interactive: false }).addTo(layer);
}

/** Thêm/bỏ một nhóm lớp khỏi bản đồ (không làm gì nếu đã đúng trạng thái). */
export function toggleGroup(map: L.Map, group: L.Layer, visible: boolean) {
  const present = map.hasLayer(group);
  if (visible && !present) group.addTo(map);
  else if (!visible && present) group.remove();
}
