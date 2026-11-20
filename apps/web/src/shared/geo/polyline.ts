import { approxDistanceMeters, METERS_PER_DEGREE, metersPerDegreeLng } from './distance';
import { toLatLng, type Coordinate, type LatLng } from './types';

/** Hình chiếu một điểm lên đoạn thẳng, tính trên mặt phẳng cục bộ đặt gốc tại chính điểm đó. */
export type SegmentProjection = {
  /** Vị trí hình chiếu dọc đoạn, 0 = đầu đoạn, 1 = cuối đoạn. */
  fraction: number;
  /** Khoảng cách vuông góc từ điểm tới đoạn, mét. */
  distanceMeters: number;
  /** Chiều dài đoạn trên cùng mặt phẳng, mét. */
  lengthMeters: number;
};

/** Hình chiếu gần nhất của một điểm lên đường gấp khúc. */
export type PolylineProjection = {
  distanceMeters: number;
  /** Quãng đường từ đầu đường gấp khúc tới hình chiếu, mét. */
  alongMeters: number;
  /** Chỉ số đoạn chứa hình chiếu (đoạn i nối điểm i và i + 1). */
  segmentIndex: number;
};

/** Chiếu `point` lên đoạn `start`→`end` (tọa độ [lat, lng]). */
export function projectOntoSegment(point: LatLng, start: Coordinate, end: Coordinate): SegmentProjection {
  const lngScale = metersPerDegreeLng(point.lat);
  const ax = (start[1] - point.lng) * lngScale;
  const ay = (start[0] - point.lat) * METERS_PER_DEGREE;
  const dx = (end[1] - start[1]) * lngScale;
  const dy = (end[0] - start[0]) * METERS_PER_DEGREE;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return {
    fraction,
    distanceMeters: Math.hypot(ax + fraction * dx, ay + fraction * dy),
    lengthMeters: Math.sqrt(lengthSquared),
  };
}

/** Hình chiếu gần nhất của `point` lên đường gấp khúc; null khi đường có ít hơn 2 điểm. */
export function closestPointOnPolyline(path: Coordinate[], point: LatLng): PolylineProjection | null {
  if (path.length < 2) return null;
  let best: PolylineProjection | null = null;
  let traveled = 0;
  for (let index = 1; index < path.length; index++) {
    const projection = projectOntoSegment(point, path[index - 1]!, path[index]!);
    if (!best || projection.distanceMeters < best.distanceMeters) {
      best = {
        distanceMeters: projection.distanceMeters,
        alongMeters: traveled + projection.fraction * projection.lengthMeters,
        segmentIndex: index - 1,
      };
    }
    traveled += projection.lengthMeters;
  }
  return best;
}

/** Chiều dài một đoạn [lat, lng], mét. */
export function segmentLengthMeters(from: Coordinate, to: Coordinate): number {
  return approxDistanceMeters(toLatLng(from), toLatLng(to));
}

/** Tổng chiều dài đường gấp khúc, mét. */
export function pathLengthMeters(path: Coordinate[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index++)
    total += segmentLengthMeters(path[index - 1]!, path[index]!);
  return total;
}

/** Điểm cách đầu đường gấp khúc `targetMeters` mét (kẹp vào hai đầu). */
export function pointAtDistance(path: Coordinate[], targetMeters: number): Coordinate {
  if (path.length === 0) throw new Error('Đường đi rỗng.');
  let traveled = 0;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const length = segmentLengthMeters(from, to);
    if (length > 0 && traveled + length >= targetMeters) {
      const ratio = Math.max(0, Math.min(1, (targetMeters - traveled) / length));
      return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    }
    traveled += length;
  }
  return path[path.length - 1]!;
}

/** Điểm nằm ở `fraction` (0..1) chiều dài đường gấp khúc. */
export function pointAtFraction(path: Coordinate[], fraction: number): Coordinate {
  if (path.length === 0) throw new Error('Đường đi rỗng.');
  return pointAtDistance(path, Math.max(0, Math.min(1, fraction)) * pathLengthMeters(path));
}

/** Khoảng cách vuông góc ngắn nhất (mét) từ một điểm tới đường gấp khúc. */
export function distanceToPathMeters(path: Coordinate[], point: LatLng): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return approxDistanceMeters(toLatLng(path[0]!), point);
  return closestPointOnPolyline(path, point)!.distanceMeters;
}

/** Vị trí (0..1) của hình chiếu một điểm lên đường gấp khúc, tính theo chiều dài. */
export function progressAlongPath(path: Coordinate[], point: LatLng): number {
  const total = pathLengthMeters(path);
  const closest = closestPointOnPolyline(path, point);
  if (!closest || total === 0) return 0;
  return closest.alongMeters / total;
}
