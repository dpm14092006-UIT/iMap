import type { Vehicle } from '../../domain/algorithms/RoadGraph.js';
import type { OsmTags } from './osmTypes.js';

/**
 * Luật đọc tag OSM để biết: xe nào được đi, đường một chiều hay hai chiều, tốc độ bao nhiêu.
 * Đây là quy ước đơn giản hóa cho đồ án, KHÔNG thay thế luật giao thông thực tế.
 */

/** Tốc độ ước tính khi đường thông thoáng (km/h) theo loại đường, dùng khi không có tag maxspeed. */
const ROAD_SPEED_KMH: Record<string, number> = {
  motorway: 80,
  motorway_link: 50,
  trunk: 60,
  trunk_link: 40,
  primary: 50,
  primary_link: 40,
  secondary: 45,
  secondary_link: 35,
  tertiary: 40,
  tertiary_link: 30,
  unclassified: 30,
  residential: 25,
  living_street: 15,
  service: 15,
};

/** Đường cho người đi bộ/đường mòn: chỉ xe máy đi được khi có tag cho phép rõ ràng (hẻm nhỏ ở TP.HCM). */
const PATH_TYPES = new Set(['footway', 'path', 'pedestrian', 'track']);
const PATH_SPEED_KMH = 12;

/** Xe máy không được đi vào đường cao tốc ở Việt Nam. */
const MOTORCYCLE_FORBIDDEN = new Set(['motorway', 'motorway_link']);

const DENIED = new Set(['no', 'private']);
const ALLOWED = new Set(['yes', 'designated', 'permissive', 'destination']);

/**
 * Đọc quyền truy cập theo thứ tự ưu tiên: tag cụ thể nhất trước (vd. motorcycle) rồi tới tag chung (access).
 * Trả true/false nếu có tag rõ ràng, undefined nếu không có tag nào.
 */
function accessFromTags(tags: OsmTags, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = tags[key];
    if (value === undefined) continue;
    if (DENIED.has(value)) return false;
    if (ALLOWED.has(value)) return true;
  }
  return undefined;
}

/** Loại xe được phép đi trên way này (mảng rỗng = bỏ qua way). */
export function allowedVehicles(tags: OsmTags): Vehicle[] {
  const highway = tags.highway;
  if (!highway || tags.area === 'yes') return [];
  const isRoad = highway in ROAD_SPEED_KMH;
  const isPath = PATH_TYPES.has(highway);
  if (!isRoad && !isPath) return [];

  // Trên đường đi bộ, tag chung "access=yes" thường chỉ nói về người đi bộ nên bỏ qua,
  // chỉ tin tag dành riêng cho xe cơ giới.
  const generalKeys = isRoad ? ['vehicle', 'access'] : [];

  const vehicles: Vehicle[] = [];
  // Ô tô: mặc định được đi trên đường xe (road), trừ khi có tag cấm.
  const carAccess = accessFromTags(tags, ['motorcar', 'motor_vehicle', ...generalKeys]);
  if (carAccess ?? isRoad) vehicles.push('car');
  // Xe máy: mặc định đi được đường xe trừ cao tốc; đường đi bộ chỉ khi có tag cho phép.
  const motorcycleAccess = accessFromTags(tags, ['motorcycle', 'moped', 'motor_vehicle', ...generalKeys]);
  if (motorcycleAccess ?? (isRoad && !MOTORCYCLE_FORBIDDEN.has(highway))) vehicles.push('motorcycle');
  return vehicles;
}

/** Chiều được phép đi so với thứ tự node trong way. */
export type TravelDirection = 'both' | 'forward' | 'backward';

/** Xác định đường một chiều cho từng loại xe (VD: `oneway:motorcycle=no` cho xe máy đi hai chiều). */
export function travelDirection(tags: OsmTags, vehicle: Vehicle): TravelDirection {
  const vehicleSpecific = vehicle === 'motorcycle' ? tags['oneway:motorcycle'] ?? tags['oneway:moped'] : undefined;
  // Vòng xuyến và cao tốc mặc định là một chiều.
  const impliedOneway = tags.junction === 'roundabout' || tags.highway === 'motorway' ? 'yes' : 'no';
  const value = vehicleSpecific ?? tags.oneway ?? impliedOneway;
  if (value === 'yes' || value === '1' || value === 'true') return 'forward';
  if (value === '-1' || value === 'reverse') return 'backward';
  return 'both';
}

/** Tốc độ (km/h): ưu tiên tag maxspeed (hỗ trợ "50", "50 km/h", "30 mph"), nếu không thì theo loại đường. */
export function speedKmh(tags: OsmTags): number {
  const match = tags.maxspeed?.match(/^(\d+(?:\.\d+)?)\s*(mph)?/);
  if (match) {
    const value = Number(match[1]);
    if (value > 0) return match[2] ? value * 1.609 : value;
  }
  return ROAD_SPEED_KMH[tags.highway ?? ''] ?? PATH_SPEED_KMH;
}

/** Danh sách tag cần giữ khi import (bỏ tag thừa để file dữ liệu gọn). */
export const RELEVANT_TAGS = [
  'highway', 'name', 'oneway', 'oneway:motorcycle', 'oneway:moped', 'junction', 'maxspeed', 'area',
  'access', 'vehicle', 'motor_vehicle', 'motorcar', 'motorcycle', 'moped',
];
