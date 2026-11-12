/**
 * Hình học trên tuyến đường, dùng để biết tuyến có đi qua sự cố không và tạo điểm vòng tránh.
 * Tuyến theo GeoJSON [lng, lat]; điểm theo {lat, lng}.
 *
 * Với khoảng cách vài km trong thành phố, chiếu phẳng (equirectangular) quanh điểm đang xét
 * cho sai số không đáng kể mà tính đơn giản hơn nhiều so với hình cầu.
 */
type LatLng = { lat: number; lng: number };
type Coordinate = [number, number]; // [lng, lat]

const METERS_PER_DEGREE_LAT = 111_320;

/** Đổi điểm sang tọa độ phẳng (mét) quanh gốc `origin`. */
function toMeters(point: LatLng, origin: LatLng): { x: number; y: number } {
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (point.lng - origin.lng) * metersPerDegreeLng,
    y: (point.lat - origin.lat) * METERS_PER_DEGREE_LAT,
  };
}

const toLatLng = ([lng, lat]: Coordinate): LatLng => ({ lat, lng });

/** Khoảng cách ngắn nhất (mét) từ điểm tới đoạn thẳng AB. */
export function distanceToSegmentMeters(point: LatLng, a: LatLng, b: LatLng): number {
  const p = { x: 0, y: 0 }; // điểm đang xét làm gốc
  const pa = toMeters(a, point);
  const pb = toMeters(b, point);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const lengthSquared = dx * dx + dy * dy;
  // t = vị trí hình chiếu của P lên AB (0 = A, 1 = B), kẹp trong đoạn.
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lengthSquared));
  return Math.hypot(pa.x + t * dx - p.x, pa.y + t * dy - p.y);
}

/** Đoạn của tuyến gần điểm nhất: chỉ số đoạn (i → i+1) và khoảng cách (mét). */
export function nearestSegment(point: LatLng, line: Coordinate[]): { index: number; distanceMeters: number } {
  let best = { index: 0, distanceMeters: Infinity };
  for (let i = 0; i + 1 < line.length; i++) {
    const distanceMeters = distanceToSegmentMeters(point, toLatLng(line[i]!), toLatLng(line[i + 1]!));
    if (distanceMeters < best.distanceMeters) best = { index: i, distanceMeters };
  }
  return best;
}

/** Tuyến có đi qua vòng tròn (center, radius) không. */
export function routePassesNear(line: Coordinate[], center: LatLng, radiusMeters: number): boolean {
  return nearestSegment(center, line).distanceMeters <= radiusMeters;
}

/**
 * Hai điểm vòng tránh nằm hai bên tuyến, vuông góc với hướng đường tại chỗ sự cố,
 * cách sự cố `offsetMeters`. Đi qua một trong hai điểm này buộc tuyến mới né khỏi sự cố.
 */
export function detourPoints(line: Coordinate[], incident: LatLng, offsetMeters: number): [LatLng, LatLng] {
  const { index } = nearestSegment(incident, line);
  const a = toMeters(toLatLng(line[index]!), incident);
  const b = toMeters(toLatLng(line[Math.min(index + 1, line.length - 1)]!), incident);
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // Vector pháp tuyến đơn vị (xoay hướng đường 90°).
  const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((incident.lat * Math.PI) / 180);
  const shift = (sign: 1 | -1): LatLng => ({
    lat: incident.lat + (sign * normal.y * offsetMeters) / METERS_PER_DEGREE_LAT,
    lng: incident.lng + (sign * normal.x * offsetMeters) / metersPerDegreeLng,
  });
  return [shift(1), shift(-1)];
}
