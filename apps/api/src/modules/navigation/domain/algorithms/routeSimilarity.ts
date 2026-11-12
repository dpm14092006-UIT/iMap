import type { RoutePathResult } from '@routetwin/shared';
import { haversineMeters } from '../../../../shared/geo/haversine.js';

const SAMPLE_COUNT = 40;
const NEAR_METERS = 60;

type Coordinate = [number, number]; // GeoJSON [lng, lat]

const toPoint = ([lng, lat]: Coordinate) => ({ lat, lng });

function samplePoints(coordinates: Coordinate[]): Coordinate[] {
  if (coordinates.length <= SAMPLE_COUNT) return coordinates;
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    return coordinates[Math.round((index * (coordinates.length - 1)) / (SAMPLE_COUNT - 1))]!;
  });
}

/** Khoảng cách từ điểm tới đoạn thẳng gần đúng (phép chiếu phẳng cục bộ), mét. */
function distanceToSegmentMeters(point: Coordinate, a: Coordinate, b: Coordinate): number {
  const cos = Math.cos((point[1] * Math.PI) / 180);
  const toXY = (c: Coordinate) => ({ x: c[0] * cos * 111_320, y: c[1] * 110_540 });
  const p = toXY(point);
  const s = toXY(a);
  const e = toXY(b);
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (s.x + t * dx), p.y - (s.y + t * dy));
}

function isNearPolyline(point: Coordinate, line: Coordinate[]): boolean {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    // Loại nhanh các đoạn quá xa trước khi tính chính xác.
    if (
      haversineMeters(toPoint(point), toPoint(a)) > 5_000 &&
      haversineMeters(toPoint(point), toPoint(b)) > 5_000
    ) {
      continue;
    }
    if (distanceToSegmentMeters(point, a, b) <= NEAR_METERS) return true;
  }
  return false;
}

/** Tỉ lệ điểm mẫu của `a` nằm trong ~60 m so với đường `b`. */
function overlapRatio(a: Coordinate[], b: Coordinate[]): number {
  const samples = samplePoints(a);
  if (!samples.length || b.length < 2) return 0;
  return samples.filter((point) => isNearPolyline(point, b)).length / samples.length;
}

/**
 * Hai tuyến coi là gần như trùng khi khoảng cách lệch ≤1%, thời gian lệch ≤2%
 * và ≥90% điểm mẫu của tuyến này nằm sát tuyến kia (xét cả hai chiều).
 */
export function areNearDuplicateRoutes(a: RoutePathResult, b: RoutePathResult): boolean {
  const within = (x: number, y: number, tolerance: number) =>
    Math.abs(x - y) <= tolerance * Math.max(x, y, 1);
  if (!within(a.distanceMeters, b.distanceMeters, 0.01)) return false;
  if (!within(a.durationSeconds, b.durationSeconds, 0.02)) return false;
  return (
    overlapRatio(a.coordinates, b.coordinates) >= 0.9 && overlapRatio(b.coordinates, a.coordinates) >= 0.9
  );
}
