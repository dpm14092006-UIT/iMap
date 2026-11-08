import type { RouteInstruction } from '@routetwin/shared';
import type { Place } from '../places/types';

/** Các panel chức năng mở được từ thanh FeatureNav (và panel chi tiết địa điểm). */
export type FeatureKey = 'directions' | 'multi' | 'traffic' | 'saved' | 'ai' | 'place';
export type MapLayer = 'street' | 'satellite';
export type TransportMode = 'car' | 'motorcycle';
export type RouteObjective = 'time' | 'distance';
/** Tọa độ theo thứ tự Leaflet: [lat, lng]. */
export type Coordinate = [number, number];

/** Một chặng đường giữa hai điểm, đã đổi sang đơn vị hiển thị (km, phút). */
export type RouteLeg = {
  nodes: string[];
  points: Coordinate[];
  distanceKm: number;
  durationMin: number;
  from: Place;
  to: Place;
  instructions?: RouteInstruction[];
};

/** Kết quả tuyến đường đang hiển thị trên bản đồ (1 tuyến hoặc nhiều điểm). */
export type RoutePlan = {
  id: string;
  kind: 'route' | 'multi';
  stops: Place[];
  legs: RouteLeg[];
  distanceKm: number;
  durationMin: number;
  vehicle: TransportMode;
  objective: RouteObjective;
};

/** Điểm đi/đến đã chọn nhưng chưa tính tuyến, vẫn hiển thị marker A/B trên bản đồ. */
export type DraftStops = { origin: Place | null; destination: Place | null };

