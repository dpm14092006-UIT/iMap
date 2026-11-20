/**
 * Hồi quy cho đợt gộp hình học vào shared/geo (20/11/2026).
 *
 * Mỗi cài đặt CŨ (trước khi gộp, nhánh main 034a9ff) được chép nguyên văn vào đây làm "đáp án chuẩn",
 * rồi so với hàm MỚI trên hàng nghìn đầu vào ngẫu nhiên (seed cố định nên lỗi tái hiện được).
 * Công thức giữ nguyên thì phải khớp gần như tuyệt đối; chỗ duy nhất đổi có chủ đích (hướng đi của GPS giả:
 * phẳng -> đường tròn lớn) chỉ được lệch trong ngưỡng không ảnh hưởng tới dẫn đường.
 */
import { describe, expect, it } from 'vitest';
import { RoutePath } from '../../features/guidance/domain/RoutePath';
import { approxDistanceMeters, bearingDegrees, haversineMeters, offsetByMeters } from './distance';
import {
  closestPointOnPolyline,
  distanceToPathMeters,
  pathLengthMeters,
  pointAtDistance,
  pointAtFraction,
  progressAlongPath,
  projectOntoSegment,
  segmentLengthMeters,
} from './polyline';
import type { Coordinate, LatLng } from './types';

// ---------------------------------------------------------------------------------------------
// Đáp án chuẩn: chép nguyên văn từ mã cũ.
// ---------------------------------------------------------------------------------------------
const M = 111_320;

/** shared/geo/path.ts — approxDistanceMeters (cũ). Cùng công thức: routeCongestion.distance, RerouteOfferMemory. */
function oldApprox(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * M * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const north = (b.lat - a.lat) * M;
  return Math.hypot(east, north);
}
/** traffic/services/RerouteOfferMemory.ts — roughDistanceMeters (cũ). */
function oldRough(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const north = (b.lat - a.lat) * 111_320;
  return Math.hypot(east, north);
}
/** traffic/services/routeTraffic.ts — segmentLength (cũ). */
function oldSegmentLength(from: Coordinate, to: Coordinate): number {
  const averageLatitude = ((from[0] + to[0]) / 2) * (Math.PI / 180);
  return Math.hypot((to[1] - from[1]) * M * Math.cos(averageLatitude), (to[0] - from[0]) * M);
}
const toPoint = ([lat, lng]: Coordinate): LatLng => ({ lat, lng });
function oldPathLength(path: Coordinate[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index++)
    total += oldApprox(toPoint(path[index - 1]!), toPoint(path[index]!));
  return total;
}
function oldPointAtFraction(path: Coordinate[], fraction: number): Coordinate {
  const target = Math.max(0, Math.min(1, fraction)) * oldPathLength(path);
  let traveled = 0;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const length = oldApprox(toPoint(from), toPoint(to));
    if (length > 0 && traveled + length >= target) {
      const ratio = (target - traveled) / length;
      return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    }
    traveled += length;
  }
  return path[path.length - 1]!;
}
function oldDistanceToPath(path: Coordinate[], point: LatLng): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return oldApprox(toPoint(path[0]!), point);
  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index++) {
    const ax = (path[index - 1]![1] - point.lng) * M * cosLat;
    const ay = (path[index - 1]![0] - point.lat) * M;
    const bx = (path[index]![1] - point.lng) * M * cosLat;
    const by = (path[index]![0] - point.lat) * M;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    best = Math.min(best, Math.hypot(ax + ratio * dx, ay + ratio * dy));
  }
  return best;
}
function oldProgressAlongPath(path: Coordinate[], point: LatLng): number {
  const total = oldPathLength(path);
  if (path.length < 2 || total === 0) return 0;
  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  let best = { distance: Number.POSITIVE_INFINITY, along: 0 };
  let traveled = 0;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const ax = (from[1] - point.lng) * M * cosLat;
    const ay = (from[0] - point.lat) * M;
    const dx = (to[1] - from[1]) * M * cosLat;
    const dy = (to[0] - from[0]) * M;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const distance = Math.hypot(ax + ratio * dx, ay + ratio * dy);
    const segment = Math.sqrt(lengthSquared);
    if (distance < best.distance) best = { distance, along: traveled + ratio * segment };
    traveled += segment;
  }
  return best.along / total;
}
/** traffic/services/routeTraffic.ts — closestPointOnLeg (cũ). */
function oldClosestPointOnLeg(points: Coordinate[], point: LatLng) {
  if (points.length < 2) return null;
  const project = (p: Coordinate): [number, number] => {
    const cosLatitude = Math.cos((point.lat * Math.PI) / 180);
    return [(p[1] - point.lng) * M * cosLatitude, (p[0] - point.lat) * M];
  };
  let closest: { distanceMeters: number; distanceAlongLegMeters: number } | null = null;
  let along = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const [ax, ay] = project(points[index]!);
    const [bx, by] = project(points[index + 1]!);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const candidate = Math.hypot(ax + ratio * dx, ay + ratio * dy);
    const length = Math.sqrt(lengthSquared);
    if (!closest || candidate < closest.distanceMeters) {
      closest = { distanceMeters: candidate, distanceAlongLegMeters: along + ratio * length };
    }
    along += length;
  }
  return closest;
}
/** traffic/services/routeTraffic.ts — pointAtDistance (cũ). */
function oldPointAtDistance(points: Coordinate[], targetDistance: number): Coordinate {
  let traveled = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const length = oldSegmentLength(from, to);
    if (traveled + length >= targetDistance && length > 0) {
      const ratio = Math.max(0, Math.min(1, (targetDistance - traveled) / length));
      return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    }
    traveled += length;
  }
  return points[points.length - 1]!;
}
/** explore/services/simplifyPath.ts — distanceToSegment (cũ). */
function oldSimplifyDistance(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const cos = Math.cos((p[0] * Math.PI) / 180);
  const ax = (a[1] - p[1]) * M * cos;
  const ay = (a[0] - p[0]) * M;
  const bx = (b[1] - p[1]) * M * cos;
  const by = (b[0] - p[0]) * M;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
/** navigation/domain/Geodesy.ts — distanceMeters (cũ, haversine không kẹp). */
function oldHaversine(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
/** navigation/domain/Geodesy.ts — projectOntoSegment (cũ: tỉ lệ trên mặt phẳng, khoảng cách haversine). */
function oldGeodesyProject(point: LatLng, start: LatLng, end: LatLng) {
  const lngScale = M * Math.cos((point.lat * Math.PI) / 180);
  const dx = (end.lng - start.lng) * lngScale;
  const dy = (end.lat - start.lat) * M;
  const px = (point.lng - start.lng) * lngScale;
  const py = (point.lat - start.lat) * M;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
  const projected = {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
  };
  return { fraction, distance: oldHaversine(point, projected) };
}
/** navigation/hooks/useNavigationSession.ts — bearingDegrees (cũ, đường tròn lớn). */
function oldGreatCircleBearing(from: LatLng, to: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(to.lng - from.lng)) * Math.cos(r(to.lat));
  const x =
    Math.cos(r(from.lat)) * Math.sin(r(to.lat)) -
    Math.sin(r(from.lat)) * Math.cos(r(to.lat)) * Math.cos(r(to.lng - from.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Công thức hướng và dịch chuyển cũ trên mặt phẳng. */
function oldPlanarBearing(a: LatLng, b: LatLng): number {
  const east = (b.lng - a.lng) * M * Math.cos((a.lat * Math.PI) / 180);
  const north = (b.lat - a.lat) * M;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}
function oldMove(point: LatLng, degrees: number, meters: number): LatLng {
  const radians = (degrees * Math.PI) / 180;
  return {
    lat: point.lat + (Math.cos(radians) * meters) / M,
    lng: point.lng + (Math.sin(radians) * meters) / (M * Math.cos((point.lat * Math.PI) / 180)),
  };
}

// ---------------------------------------------------------------------------------------------
// Sinh dữ liệu ngẫu nhiên có seed.
// ---------------------------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261120);
/** Tâm thành phố Việt Nam và một điểm vĩ độ cao để thử biên. */
const centers: LatLng[] = [
  { lat: 10.7769, lng: 106.7009 }, // TP.HCM
  { lat: 21.0278, lng: 105.8342 }, // Hà Nội
  { lat: 16.0544, lng: 108.2022 }, // Đà Nẵng
  { lat: 0.5, lng: 100 }, // gần xích đạo
  { lat: 48.85, lng: 2.35 }, // vĩ độ cao
];
const jitter = (center: LatLng, meters: number): LatLng => ({
  lat: center.lat + ((random() - 0.5) * 2 * meters) / M,
  lng: center.lng + ((random() - 0.5) * 2 * meters) / (M * Math.cos((center.lat * Math.PI) / 180)),
});
const toCoord = ({ lat, lng }: LatLng): Coordinate => [lat, lng];
/** Đường gấp khúc ngẫu nhiên; thỉnh thoảng có điểm trùng (đoạn dài 0) để thử biên. */
function randomPath(center: LatLng, spanMeters: number): Coordinate[] {
  const count = 1 + Math.floor(random() * 25);
  const path: Coordinate[] = [];
  for (let index = 0; index < count; index++) {
    path.push(index > 0 && random() < 0.1 ? path[index - 1]! : toCoord(jitter(center, spanMeters)));
  }
  return path;
}
const CASES = 2_000;
const each = (run: (center: LatLng, index: number) => void) => {
  for (let index = 0; index < CASES; index++) run(centers[index % centers.length]!, index);
};
const closeTo = (actual: number, expected: number, tolerance = 1e-6) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));

// ---------------------------------------------------------------------------------------------
describe('hồi quy gộp hình học: công thức giữ nguyên phải khớp', () => {
  it('approxDistanceMeters = path.approx = RerouteOfferMemory.rough = routeTraffic.segmentLength', () => {
    each((center) => {
      const a = jitter(center, 20_000);
      const b = jitter(center, 20_000);
      closeTo(approxDistanceMeters(a, b), oldApprox(a, b));
      closeTo(approxDistanceMeters(a, b), oldRough(a, b));
      closeTo(segmentLengthMeters(toCoord(a), toCoord(b)), oldSegmentLength(toCoord(a), toCoord(b)));
    });
  });

  it('haversineMeters = Geodesy.distanceMeters (cũ) = SpeedEstimator', () => {
    each((center) => {
      const a = jitter(center, 50_000);
      const b = jitter(center, 50_000);
      closeTo(haversineMeters(a, b), oldHaversine(a, b), 1e-9);
    });
  });

  it('pathLength / pointAtFraction / distanceToPath / progressAlongPath khớp shared/geo/path cũ', () => {
    each((center) => {
      const path = randomPath(center, 3_000);
      const point = jitter(center, 3_500);
      const fraction = random() * 1.2 - 0.1; // gồm cả ngoài [0, 1]
      closeTo(pathLengthMeters(path), oldPathLength(path));
      const now = pointAtFraction(path, fraction);
      const before = oldPointAtFraction(path, fraction);
      closeTo(now[0], before[0], 1e-12);
      closeTo(now[1], before[1], 1e-12);
      closeTo(distanceToPathMeters(path, point), oldDistanceToPath(path, point));
      closeTo(progressAlongPath(path, point), oldProgressAlongPath(path, point));
    });
  });

  it('closestPointOnPolyline / pointAtDistance khớp routeTraffic cũ', () => {
    each((center) => {
      const path = randomPath(center, 3_000);
      const point = jitter(center, 3_500);
      const before = oldClosestPointOnLeg(path, point);
      const now = closestPointOnPolyline(path, point);
      if (!before) {
        expect(now).toBeNull();
      } else {
        closeTo(now!.distanceMeters, before.distanceMeters);
        closeTo(now!.alongMeters, before.distanceAlongLegMeters);
      }
      const target = random() * oldPathLength(path) * 1.2;
      const a = pointAtDistance(path, target);
      const b = oldPointAtDistance(path, target);
      closeTo(a[0], b[0], 1e-12);
      closeTo(a[1], b[1], 1e-12);
    });
  });

  it('projectOntoSegment().distanceMeters khớp simplifyPath.distanceToSegment cũ', () => {
    each((center) => {
      const [p, a, b] = [jitter(center, 2_000), jitter(center, 2_000), jitter(center, 2_000)].map(
        toCoord,
      ) as [Coordinate, Coordinate, Coordinate];
      closeTo(
        projectOntoSegment({ lat: p[0], lng: p[1] }, a, b).distanceMeters,
        oldSimplifyDistance(p, a, b),
      );
    });
  });

  it('bearingDegrees khớp useNavigationSession cũ; offsetByMeters khớp công thức dịch chuyển cũ', () => {
    each((center) => {
      const a = jitter(center, 5_000);
      const b = jitter(center, 5_000);
      closeTo(bearingDegrees(a, b), oldGreatCircleBearing(a, b), 1e-12);
      const degrees = random() * 360;
      const meters = random() * 300;
      const now = offsetByMeters(a, degrees, meters);
      const before = oldMove(a, degrees, meters);
      closeTo(now.lat, before.lat, 1e-12);
      closeTo(now.lng, before.lng, 1e-12);
    });
  });
});

describe('hồi quy gộp hình học: dẫn đường và thay đổi có chủ đích', () => {
  it('RoutePath.closest khớp tuyệt đối Geodesy.projectOntoSegment cũ (tỉ lệ và khoảng cách haversine)', () => {
    each((center) => {
      const path = randomPath(center, 2_000);
      if (path.length < 2) return;
      const point = jitter(center, 2_500);
      const routePath = new RoutePath([{ points: path }]);
      // Đáp án cũ: duyệt từng đoạn như RoutePath cũ với Geodesy.
      let offset = 0;
      let best: { distance: number; progress: number } | null = null;
      for (let index = 1; index < path.length; index++) {
        const start = toPoint(path[index - 1]!);
        const end = toPoint(path[index]!);
        const length = oldHaversine(start, end);
        const projection = oldGeodesyProject(point, start, end);
        const progress = offset + length * projection.fraction;
        if (!best || projection.distance < best.distance) best = { distance: projection.distance, progress };
        offset += length;
      }
      const now = routePath.closest(point)!;
      closeTo(now.distance, best!.distance, 1e-9);
      closeTo(now.progress, best!.progress, 1e-9);
      closeTo(routePath.totalMeters, offset, 1e-9);
    });
  });

  it('GPS giả: hướng đường tròn lớn lệch hướng phẳng cũ < 0,05° với bước ≤ 500 m ở Việt Nam', () => {
    const vietnam = centers.slice(0, 4);
    for (let index = 0; index < CASES; index++) {
      const a = jitter(vietnam[index % vietnam.length]!, 20_000);
      const b = jitter(a, 500);
      if (approxDistanceMeters(a, b) < 0.5) continue; // GPS giả không tính hướng khi gần như đứng yên
      const diff = Math.abs(bearingDegrees(a, b) - oldPlanarBearing(a, b));
      expect(Math.min(diff, 360 - diff)).toBeLessThan(0.05);
    }
  });
});
