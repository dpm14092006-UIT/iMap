import { z } from 'zod';
import { MAX_OPTIMIZE_POINTS } from '../constants.js';
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export const routeRequestSchema = z.object({
  points: z.array(geoPointSchema).min(2).max(25),
  vehicle: z.enum(['car', 'motorcycle']),
  objective: z.enum(['distance', 'duration']).default('duration'),
  alternatives: z.boolean().optional(),
  avoid: z.array(z.enum(['ferry', 'toll'])).optional(),
});
export type RouteRequest = z.infer<typeof routeRequestSchema>;
export type RouteInstruction = {
  distanceMeters: number;
  durationSeconds: number;
  text: string;
  streetName: string;
  sign?: number;
  heading?: number;
};
/**
 * Vì sao phương án này tồn tại: tuyến mặc định, tuyến tính với tùy chọn tránh đã kiểm chứng được,
 * hoặc `alternative` (tuyến khác hẳn nhưng không kiểm chứng được là đã tránh điều gì).
 * `avoid-toll` chỉ dùng khi VietMap báo toll_cost = 0 cho tuyến đó.
 */
export const routeVariants = ['default', 'alternative', 'avoid-toll', 'avoid-ferry'] as const;
export type RouteVariant = (typeof routeVariants)[number];
export const congestionLevels = ['low', 'moderate', 'heavy', 'severe', 'unknown'] as const;
export type CongestionLevel = (typeof congestionLevels)[number];
/** Một đoạn tuyến có cùng mức ùn tắc; from/to là chỉ số trong `coordinates` (gồm cả hai đầu). */
export type CongestionSegment = { level: CongestionLevel; from: number; to: number };
export type RouteCongestion = {
  segments: CongestionSegment[];
  /** Tổng chiều dài (mét) các đoạn VietMap báo ùn tắc (congestion_distance). */
  heavyMeters: number;
};
export type RoutePathResult = {
  source: 'vietmap';
  variant?: RouteVariant;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // GeoJSON [lng, lat]
  instructions: RouteInstruction[];
  tollCostVnd?: number;
  /** Mức giao thông theo đoạn từ VietMap; vắng mặt khi không có dữ liệu (tuyến nhiều điểm, lỗi...). */
  congestion?: RouteCongestion;
};
export type RouteResult = RoutePathResult & {
  /** Các tuyến thay thế mà Route v4 trả về khi alternatives=true. */
  alternatives?: RoutePathResult[];
};

/**
 * Thuật toán sắp xếp điểm ghé:
 * - exact:     Held–Karp, tối ưu chính xác (tới 16 điểm ≈ 30 ms)
 * - heuristic: Nearest Neighbor + 2-opt, gần đúng, nhanh hơn; dùng để so sánh
 * - auto:      exact khi trong giới hạn của Held–Karp, ngược lại heuristic
 */
export const tourAlgorithms = ['auto', 'exact', 'heuristic'] as const;

/** Fixed departure, up to fifteen stops; departure is repeated only in the optimized closed tour. */
export const optimizeRouteRequestSchema = z
  .object({
    points: z.array(geoPointSchema).min(2).max(MAX_OPTIMIZE_POINTS),
    vehicle: z.enum(['car', 'motorcycle']),
    objective: z.enum(['distance', 'duration']).default('duration'),
    returnToStart: z.boolean().default(false),
    algorithm: z.enum(tourAlgorithms).default('auto'),
  })
  .refine(
    ({ points }) =>
      points.every((point, index) =>
        points
          .slice(0, index)
          .every(
            (other) =>
              Math.abs(point.lat - other.lat) > 0.000001 || Math.abs(point.lng - other.lng) > 0.000001,
          ),
      ),
    { message: 'Các điểm dừng không được trùng vị trí.' },
  );
export type OptimizeRouteRequest = z.infer<typeof optimizeRouteRequestSchema>;
export type OptimizeRouteResult = {
  order: number[];
  route: RouteResult;
  /** Chi phí nếu đi theo thứ tự người dùng nhập (null nếu thứ tự đó không đi được). */
  originalCost: number | null;
  optimizedCost: number;
  objective: 'distance' | 'duration';
  /** Thuật toán thực sự đã dùng (auto được quy về exact hoặc heuristic). */
  algorithm: 'exact' | 'heuristic';
};
