import type { RoutePlan } from '../../routing/types';
import type { Coordinate, LatLng } from '../../../shared/geo/types';
import {
  closestPointOnPolyline,
  pathLengthMeters,
  pointAtDistance,
  segmentLengthMeters,
} from '../../../shared/geo/polyline';
import type { TrafficMapLayer, TrafficSeverity } from './trafficMapLayer';

export const ROUTE_ALERT_CORRIDOR_METERS = 180;

type RouteTrafficReport = {
  lat: number;
  lng: number;
  status: 'active' | 'cleared' | 'expired';
  vehicleScope: 'car' | 'motorcycle' | 'both';
};

/** Khoảng cách từ sự cố tới tuyến, dùng cùng hành lang cho cảnh báo và tô màu. */
function distanceToRouteMeters(route: RoutePlan, point: LatLng): number {
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const leg of route.legs) {
    const closest = closestPointOnPolyline(leg.points, point);
    if (closest && closest.distanceMeters < closestDistance) closestDistance = closest.distanceMeters;
  }
  return closestDistance;
}

/** Chỉ phát cảnh báo cho sự cố còn hoạt động nằm trong hành lang 180 m quanh tuyến. */
export function shouldNotifyTrafficReportOnRoute(route: RoutePlan, report: RouteTrafficReport): boolean {
  return (
    report.status === 'active' &&
    (report.vehicleScope === 'both' || report.vehicleScope === route.vehicle) &&
    distanceToRouteMeters(route, { lat: report.lat, lng: report.lng }) <= ROUTE_ALERT_CORRIDOR_METERS
  );
}

/** Mức sự cố nặng nhất đang nằm trong hành lang quanh tuyến; null nếu tuyến thông thoáng. */
export function routeTrafficSeverity(route: RoutePlan, layer: TrafficMapLayer): TrafficSeverity | null {
  const rank: Record<TrafficSeverity, number> = { low: 0, medium: 1, high: 2 };
  let worst: TrafficSeverity | null = null;
  for (const { properties, geometry } of layer.features) {
    if (properties.status !== 'active') continue;
    const [lng, lat] = geometry.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (distanceToRouteMeters(route, { lat, lng }) > ROUTE_ALERT_CORRIDOR_METERS) continue;
    if (worst === null || rank[properties.severity] > rank[worst]) worst = properties.severity;
  }
  return worst;
}

/** Lấy đoạn tuyến ngắn quanh điểm báo cáo; giữ phần còn lại của tuyến màu xanh. */
export function routeHazardSection(
  route: RoutePlan,
  point: LatLng,
  halfLengthMeters = 85,
): { distanceMeters: number; points: Coordinate[] } | null {
  let closest: { distanceMeters: number; alongMeters: number; legIndex: number } | null = null;
  for (let legIndex = 0; legIndex < route.legs.length; legIndex++) {
    const candidate = closestPointOnPolyline(route.legs[legIndex]!.points, point);
    if (candidate && (!closest || candidate.distanceMeters < closest.distanceMeters)) {
      closest = { ...candidate, legIndex };
    }
  }
  if (!closest) return null;

  const points = route.legs[closest.legIndex]!.points;
  const totalLength = pathLengthMeters(points);
  const start = Math.max(0, closest.alongMeters - halfLengthMeters);
  const end = Math.min(totalLength, closest.alongMeters + halfLengthMeters);
  const section = [pointAtDistance(points, start)];
  let traveled = 0;
  for (let index = 0; index < points.length - 1; index++) {
    traveled += segmentLengthMeters(points[index]!, points[index + 1]!);
    if (traveled > start && traveled < end) section.push(points[index + 1]!);
  }
  section.push(pointAtDistance(points, end));
  return { distanceMeters: closest.distanceMeters, points: section };
}
