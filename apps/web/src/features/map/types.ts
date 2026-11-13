import type { RouteCongestion, RouteInstruction, RouteVariant } from '@routetwin/shared';
import type { Place } from '../places/types';

/** Các panel chức năng mở được từ dock (cùng panel chi tiết địa điểm và kết quả POI). */
export type FeatureKey = 'directions' | 'multi' | 'traffic' | 'saved' | 'place' | 'assistant' | 'poi';
/** 'dark' là nền bản đồ tối, tự bật từ 18:00 đến 06:00 (xem useTimeBasedMapLayer). */
export type MapLayer = 'street' | 'satellite' | 'dark';
export type TransportMode = 'car' | 'motorcycle';
export type RouteObjective = 'time' | 'distance';
/** Tọa độ theo thứ tự Leaflet: [lat, lng]. */
export type Coordinate = [number, number];

/** Một chặng đường giữa hai điểm, đã đổi sang đơn vị hiển thị (km, phút). */
type RouteLeg = {
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
  tollCostVnd?: number;
  /** Mức ùn tắc theo đoạn từ VietMap (chỉ khi tuyến 2 điểm); chỉ số khớp `legs[0].points`. */
  congestion?: RouteCongestion;
  /** Vì sao phương án này tồn tại (tuyến mặc định hay tránh trạm thu phí/cao tốc/phà). */
  variant?: RouteVariant;
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
export type DraftStops = {
  origin: Place | null;
  destination: Place | null;
  /** Địa điểm đang xem chi tiết (từ ô tìm kiếm / bấm bản đồ), vẽ ghim riêng kể cả khi có tuyến. */
  focus?: Place | null;
};

/** Công tắc các lớp phủ trên bản đồ. */
export type MapOverlays = { traffic: boolean; incidents: boolean; terrain: boolean };
