import type { RouteCongestion, RouteInstruction, RouteVariant } from '@routetwin/shared';
import type { Coordinate, LatLng } from '../../shared/geo/types';
import type { Place } from '../places/types';
import type { TrafficMapLayer } from '../traffic/domain/trafficMapLayer';
import type { DirectionsController } from './hooks/useDirections';

export type TransportMode = 'car' | 'motorcycle';
export type RouteObjective = 'time' | 'distance';

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
  tollCostVnd?: number;
  /** Mức ùn tắc theo đoạn từ VietMap (chỉ khi tuyến 2 điểm); chỉ số khớp `legs[0].points`. */
  congestion?: RouteCongestion;
  /** Vì sao phương án này tồn tại (tuyến mặc định hay tránh trạm thu phí/cao tốc/phà). */
  variant?: RouteVariant;
  /** Chỉ có khi hành trình nhiều điểm đã được sắp xếp lại thứ tự. */
  optimization?: RouteOptimization;
  /** Tuyến được tính với tùy chọn tránh phà; mọi lần tính lại tuyến này (trợ lý thêm/bỏ điểm ghé…) phải giữ. */
  avoidFerry?: boolean;
};

/** Kết quả sắp xếp thứ tự ghé: thuật toán đã dùng và chi phí trước/sau (giây hoặc mét). */
export type RouteOptimization = {
  algorithm: 'exact' | 'heuristic';
  originalCost: number | null;
  optimizedCost: number;
  objective: 'distance' | 'duration';
};
export type PickTarget = 'origin' | 'destination';
export type RoutePanelProps = {
  getSearchFocus?: () => LatLng;
  directions: DirectionsController;
  /** Sự cố giao thông để tô màu thời gian từng phương án. */
  trafficLayer: TrafficMapLayer;
  pickTarget: PickTarget | null;
  isLocating: boolean;
  onPickOnMap: (target: PickTarget) => void;
  onUseMyLocation: () => void;
  onSave: () => void;
  onStartNavigation: (route: RoutePlan) => void;
  /** Chọn tuyến rồi zoom bản đồ vừa tuyến đó. */
  onPreviewRoute: (route: RoutePlan) => void;
  isNavigating: boolean;
  onClose: () => void;
};
