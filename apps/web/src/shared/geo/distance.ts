import { haversineMeters as sharedHaversineMeters } from '@routetwin/shared';
import type { LatLng } from './types';

/** Số mét trên một độ vĩ độ (gần như không đổi trên toàn cầu). */
export const METERS_PER_DEGREE = 111_320;
export const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Số mét trên một độ kinh độ tại vĩ độ `lat`. */
export function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE * Math.cos(toRadians(lat));
}

/** Khoảng cách đường chim bay chính xác trên mặt cầu (haversine), mét. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  // Keep the historical web radius so stored geometry retains its exact distances.
  return sharedHaversineMeters(a, b, EARTH_RADIUS_METERS);
}

/**
 * Khoảng cách xấp xỉ trên mặt phẳng cục bộ (equirectangular, lấy vĩ độ trung bình), mét.
 * Nhanh hơn haversine và sai lệch không đáng kể ở quy mô thành phố; dùng cho các vòng lặp trên tuyến.
 */
export function approxDistanceMeters(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * metersPerDegreeLng((a.lat + b.lat) / 2);
  const north = (b.lat - a.lat) * METERS_PER_DEGREE;
  return Math.hypot(east, north);
}

/** Hướng ban đầu (độ, 0 = Bắc, 90 = Đông) đi từ `from` tới `to` theo đường tròn lớn. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const latitudeFrom = toRadians(from.lat);
  const latitudeTo = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeTo);
  const x =
    Math.cos(latitudeFrom) * Math.sin(latitudeTo) -
    Math.sin(latitudeFrom) * Math.cos(latitudeTo) * Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Dời `point` đi `meters` mét theo hướng `degrees` (mặt phẳng cục bộ, đủ cho quãng ngắn). */
export function offsetByMeters(point: LatLng, degrees: number, meters: number): LatLng {
  const radians = toRadians(degrees);
  return {
    lat: point.lat + (Math.cos(radians) * meters) / METERS_PER_DEGREE,
    lng: point.lng + (Math.sin(radians) * meters) / metersPerDegreeLng(point.lat),
  };
}
