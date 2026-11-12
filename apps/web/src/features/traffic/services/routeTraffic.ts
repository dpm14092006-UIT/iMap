import type { RoutePlan, Coordinate } from '../../map/types';
import type { LatLng } from '../../places/types';

type ClosestRoutePoint = {
  distanceMeters: number;
  legIndex: number;
  distanceAlongLegMeters: number;
};

const METERS_PER_DEGREE = 111_320;
export const ROUTE_ALERT_CORRIDOR_METERS = 180;

type RouteTrafficReport = {
  lat: number;
  lng: number;
  status: 'active' | 'cleared' | 'expired';
};

function project(point: Coordinate, origin: LatLng): [number, number] {
  const cosLatitude = Math.cos((origin.lat * Math.PI) / 180);
  return [
    (point[1] - origin.lng) * METERS_PER_DEGREE * cosLatitude,
    (point[0] - origin.lat) * METERS_PER_DEGREE,
  ];
}

function segmentLength(from: Coordinate, to: Coordinate): number {
  const averageLatitude = ((from[0] + to[0]) / 2) * (Math.PI / 180);
  const east = (to[1] - from[1]) * METERS_PER_DEGREE * Math.cos(averageLatitude);
  const north = (to[0] - from[0]) * METERS_PER_DEGREE;
  return Math.hypot(east, north);
}

function closestPointOnLeg(points: Coordinate[], point: LatLng) {
  if (points.length < 2) return null;
  let closest: { distanceMeters: number; distanceAlongLegMeters: number } | null = null;
  let distanceAlongLegMeters = 0;

  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const [ax, ay] = project(from, point);
    const [bx, by] = project(to, point);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const closestX = ax + ratio * dx;
    const closestY = ay + ratio * dy;
    const candidateDistance = Math.hypot(closestX, closestY);
    const length = Math.sqrt(lengthSquared);

    if (!closest || candidateDistance < closest.distanceMeters) {
      closest = {
        distanceMeters: candidateDistance,
        distanceAlongLegMeters: distanceAlongLegMeters + ratio * length,
      };
    }
    distanceAlongLegMeters += length;
  }
  return closest;
}

/** Khoảng cách từ sự cố tới tuyến, dùng cùng hành lang cho cảnh báo và tô màu. */
export function distanceToRouteMeters(route: RoutePlan, point: LatLng): number {
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const leg of route.legs) {
    const closest = closestPointOnLeg(leg.points, point);
    if (closest && closest.distanceMeters < closestDistance) closestDistance = closest.distanceMeters;
  }
  return closestDistance;
}

/** Chỉ phát cảnh báo cho sự cố còn hoạt động nằm trong hành lang 180 m quanh tuyến. */
export function shouldNotifyTrafficReportOnRoute(route: RoutePlan, report: RouteTrafficReport): boolean {
  return (
    report.status === 'active' &&
    distanceToRouteMeters(route, { lat: report.lat, lng: report.lng }) <= ROUTE_ALERT_CORRIDOR_METERS
  );
}

function pointAtDistance(points: Coordinate[], targetDistance: number): Coordinate {
  let traveled = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const length = segmentLength(from, to);
    if (traveled + length >= targetDistance && length > 0) {
      const ratio = Math.max(0, Math.min(1, (targetDistance - traveled) / length));
      return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    }
    traveled += length;
  }
  return points[points.length - 1]!;
}

/** Lấy đoạn tuyến ngắn quanh điểm báo cáo; giữ phần còn lại của tuyến màu xanh. */
export function routeHazardSection(
  route: RoutePlan,
  point: LatLng,
  halfLengthMeters = 85,
): { distanceMeters: number; points: Coordinate[] } | null {
  let closest: ClosestRoutePoint | null = null;
  for (let legIndex = 0; legIndex < route.legs.length; legIndex++) {
    const candidate = closestPointOnLeg(route.legs[legIndex]!.points, point);
    if (candidate && (!closest || candidate.distanceMeters < closest.distanceMeters)) {
      closest = { ...candidate, legIndex };
    }
  }
  if (!closest) return null;

  const points = route.legs[closest.legIndex]!.points;
  const totalLength = points
    .slice(1)
    .reduce((total, current, index) => total + segmentLength(points[index]!, current), 0);
  const start = Math.max(0, closest.distanceAlongLegMeters - halfLengthMeters);
  const end = Math.min(totalLength, closest.distanceAlongLegMeters + halfLengthMeters);
  const section = [pointAtDistance(points, start)];
  let traveled = 0;
  for (let index = 0; index < points.length - 1; index++) {
    traveled += segmentLength(points[index]!, points[index + 1]!);
    if (traveled > start && traveled < end) section.push(points[index + 1]!);
  }
  section.push(pointAtDistance(points, end));
  return { distanceMeters: closest.distanceMeters, points: section };
}
