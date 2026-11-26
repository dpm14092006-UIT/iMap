import type { LatLng } from './types';

const EARTH_RADIUS_METERS = 6_378_137;

/**
 * Đa giác GeoJSON gần đúng hình tròn bán kính `meters` quanh một điểm ([kinh độ, vĩ độ], vòng khép kín).
 * Dùng cho quầng giao thông tính theo mét trên bản đồ WebGL (không có lớp "circle" theo mét).
 */
export function circlePolygon(center: LatLng, meters: number, steps = 48): GeoJSON.Polygon {
  const ring: [number, number][] = [];
  const latRad = (center.lat * Math.PI) / 180;
  for (let index = 0; index <= steps; index++) {
    const angle = (index / steps) * Math.PI * 2;
    const dLat = ((meters * Math.cos(angle)) / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const dLng = ((meters * Math.sin(angle)) / (EARTH_RADIUS_METERS * Math.cos(latRad))) * (180 / Math.PI);
    ring.push([center.lng + dLng, center.lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
