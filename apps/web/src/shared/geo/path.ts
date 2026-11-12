import type { Coordinate } from '../../features/map/types';
import type { LatLng } from '../../features/places/types';

const METERS_PER_DEGREE = 111_320;

/** Khoảng cách xấp xỉ (mét) giữa hai điểm, đủ chính xác ở quy mô thành phố. */
export function approxDistanceMeters(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * METERS_PER_DEGREE * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const north = (b.lat - a.lat) * METERS_PER_DEGREE;
  return Math.hypot(east, north);
}

const toPoint = ([lat, lng]: Coordinate): LatLng => ({ lat, lng });

/** Tổng chiều dài đường gấp khúc, mét. */
export function pathLengthMeters(path: Coordinate[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index++) {
    total += approxDistanceMeters(toPoint(path[index - 1]!), toPoint(path[index]!));
  }
  return total;
}

/** Điểm nằm ở `fraction` (0..1) chiều dài đường gấp khúc. */
export function pointAtFraction(path: Coordinate[], fraction: number): Coordinate {
  if (path.length === 0) throw new Error('Đường đi rỗng.');
  const target = Math.max(0, Math.min(1, fraction)) * pathLengthMeters(path);
  let traveled = 0;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const length = approxDistanceMeters(toPoint(from), toPoint(to));
    if (length > 0 && traveled + length >= target) {
      const ratio = (target - traveled) / length;
      return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    }
    traveled += length;
  }
  return path[path.length - 1]!;
}

/** Khoảng cách vuông góc ngắn nhất (mét) từ một điểm tới đường gấp khúc. */
export function distanceToPathMeters(path: Coordinate[], point: LatLng): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return approxDistanceMeters(toPoint(path[0]!), point);
  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index++) {
    const ax = (path[index - 1]![1] - point.lng) * METERS_PER_DEGREE * cosLat;
    const ay = (path[index - 1]![0] - point.lat) * METERS_PER_DEGREE;
    const bx = (path[index]![1] - point.lng) * METERS_PER_DEGREE * cosLat;
    const by = (path[index]![0] - point.lat) * METERS_PER_DEGREE;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    best = Math.min(best, Math.hypot(ax + ratio * dx, ay + ratio * dy));
  }
  return best;
}

/** Vị trí (0..1) của hình chiếu một điểm lên đường gấp khúc, tính theo chiều dài. */
export function progressAlongPath(path: Coordinate[], point: LatLng): number {
  const total = pathLengthMeters(path);
  if (path.length < 2 || total === 0) return 0;
  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  let best = { distance: Number.POSITIVE_INFINITY, along: 0 };
  let traveled = 0;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const ax = (from[1] - point.lng) * METERS_PER_DEGREE * cosLat;
    const ay = (from[0] - point.lat) * METERS_PER_DEGREE;
    const dx = (to[1] - from[1]) * METERS_PER_DEGREE * cosLat;
    const dy = (to[0] - from[0]) * METERS_PER_DEGREE;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const distance = Math.hypot(ax + ratio * dx, ay + ratio * dy);
    const segment = Math.sqrt(lengthSquared);
    if (distance < best.distance) best = { distance, along: traveled + ratio * segment };
    traveled += segment;
  }
  return best.along / total;
}
