/** Hình học thuần cho tìm địa điểm: toạ độ [vĩ độ, kinh độ], đơn vị mét. Không phụ thuộc framework. */
import { EARTH_RADIUS_METERS, haversineMeters } from '../../../shared/geo/haversine.js';
import { stripDiacritics } from '../../../shared/text/strip-diacritics.js';

export type LatLngTuple = readonly [number, number];
export type LatLng = { lat: number; lng: number };

const METERS_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_METERS;
/** Tốc độ ước tính khi đi vòng ra địa điểm rồi quay lại. */
const DETOUR_SPEED_KMH = 25;

/** Mỗi điểm mẫu là một lượt Autocomplete tính phí nên giữ trần thấp. */
const MAX_ALONG_ROUTE_SAMPLES = 8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const point = ([lat, lng]: LatLngTuple): LatLng => ({ lat, lng });

/** Bỏ các điểm liên tiếp trùng nhau để không sinh đoạn dài 0. */
function dedupeConsecutive(path: readonly LatLngTuple[]): LatLngTuple[] {
  return path.filter((p, i) => i === 0 || p[0] !== path[i - 1]![0] || p[1] !== path[i - 1]![1]);
}

export function pathLengthMeters(path: readonly LatLngTuple[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineMeters(point(path[i - 1]!), point(path[i]!));
  return total;
}

/** Điểm nằm cách đầu tuyến `distanceM` mét (kẹp trong [0, tổng chiều dài]). */
function pointAtDistance(path: readonly LatLngTuple[], distanceM: number): LatLng {
  if (path.length === 0) throw new RangeError('Tuyến rỗng');
  let remaining = Math.max(0, distanceM);
  for (let i = 1; i < path.length; i++) {
    const from = point(path[i - 1]!);
    const to = point(path[i]!);
    const length = haversineMeters(from, to);
    if (length > 0 && remaining <= length) {
      const t = remaining / length;
      return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
    }
    remaining -= length;
  }
  return point(path[path.length - 1]!);
}

/**
 * Lấy mẫu điểm dọc tuyến: khoảng cách ≈ max(1,6 × bán kính, chiều dài / 10), tối đa `maxSamples`
 * điểm, luôn có hai đầu; các điểm cách đều nhau nên hai điểm kề nhau không xa hơn khoảng cách đó.
 */
export function sampleAlongPath(
  rawPath: readonly LatLngTuple[],
  radiusM: number,
  maxSamples = MAX_ALONG_ROUTE_SAMPLES,
): LatLng[] {
  const path = dedupeConsecutive(rawPath);
  if (path.length === 0) return [];
  const total = pathLengthMeters(path);
  if (path.length === 1 || total === 0) return [point(path[0]!)];
  const spacing = Math.max(1.6 * radiusM, total / 10);
  const count = Math.max(2, Math.min(maxSamples, Math.ceil(total / spacing) + 1));
  return Array.from({ length: count }, (_, i) => pointAtDistance(path, (total * i) / (count - 1)));
}

/** Khoảng cách vuông góc từ `p` tới tuyến và vị trí hình chiếu (mét từ đầu tuyến). */
export function projectOnPath(
  p: LatLng,
  rawPath: readonly LatLngTuple[],
): { distanceM: number; alongM: number } {
  const path = dedupeConsecutive(rawPath);
  if (path.length === 0) return { distanceM: Number.POSITIVE_INFINITY, alongM: 0 };
  if (path.length === 1) return { distanceM: haversineMeters(p, point(path[0]!)), alongM: 0 };
  const cosLat = Math.cos(toRadians(p.lat));
  let best = { distanceM: Number.POSITIVE_INFINITY, alongM: 0 };
  let traveled = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const ax = (a[1] - p.lng) * METERS_PER_DEGREE * cosLat;
    const ay = (a[0] - p.lat) * METERS_PER_DEGREE;
    const dx = (b[1] - a[1]) * METERS_PER_DEGREE * cosLat;
    const dy = (b[0] - a[0]) * METERS_PER_DEGREE;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const distanceM = Math.hypot(ax + t * dx, ay + t * dy);
    const segment = haversineMeters(point(a), point(b));
    if (distanceM < best.distanceM) best = { distanceM, alongM: traveled + t * segment };
    traveled += segment;
  }
  return best;
}

/** Phút đi vòng ước tính: ra địa điểm và quay lại, 2 × khoảng cách ÷ 25 km/h. */
export function detourMinutes(distanceFromRouteM: number): number {
  return Math.round((2 * distanceFromRouteM) / ((DETOUR_SPEED_KMH * 1000) / 60));
}

/** Chuẩn hóa để so trùng tên/địa chỉ: bỏ dấu, chữ thường, bỏ ký tự thừa. */
export function normalizeText(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
