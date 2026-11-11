import type { RouteInstruction } from '@routetwin/shared';
import type { Place } from '../places/types';

/** Các panel chức năng mở được từ thanh FeatureNav (và panel chi tiết địa điểm). */
export type FeatureKey = 'directions' | 'multi' | 'traffic' | 'saved' | 'place' | 'assistant';
/** 'dark' là nền bản đồ tối (tự bật theo giờ trên mobile, xem useTimeBasedMapLayer). */
export type MapLayer = 'street' | 'satellite' | 'dark';
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
  /** Chỉ có khi hành trình nhiều điểm đã được sắp xếp lại thứ tự. */
  optimization?: RouteOptimization;
};

/** Kết quả sắp xếp thứ tự ghé: thuật toán đã dùng và chi phí trước/sau (giây hoặc mét). */
export type RouteOptimization = {
  algorithm: 'exact' | 'heuristic';
  originalCost: number | null;
  optimizedCost: number;
  objective: 'distance' | 'duration';
};

/** Điểm đi/đến đã chọn nhưng chưa tính tuyến, vẫn hiển thị marker A/B trên bản đồ. */
export type DraftStops = { origin: Place | null; destination: Place | null };

/** Khung hình chữ nhật theo tọa độ (vùng dữ liệu của đồ thị OSM). */
export type Bounds = { south: number; west: number; north: number; east: number };

/** Tuyến do thuật toán tự cài đặt tìm được, vẽ chồng lên bản đồ để so sánh. */
export type AlgorithmOverlay = {
  /** Đổi giá trị này khi có kết quả mới để bản đồ tự zoom vừa tuyến. */
  key: string;
  paths: { algorithm: 'dijkstra' | 'astar'; points: Coordinate[] }[];
  coverage: Bounds | null;
};
