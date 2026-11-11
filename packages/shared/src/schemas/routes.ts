import { z } from 'zod';
export const geoPointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const routeRequestSchema = z.object({
  points: z.array(geoPointSchema).min(2).max(25),
  vehicle: z.enum(['car', 'motorcycle']),
  objective: z.enum(['distance', 'duration']).default('duration'),
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
export type RouteResult = {
  source: 'vietmap';
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // GeoJSON [lng, lat]
  instructions: RouteInstruction[];
};

/**
 * Thuật toán sắp xếp điểm ghé:
 * - exact:     Held–Karp, tối ưu chính xác (tới 16 điểm ≈ 30 ms)
 * - heuristic: Nearest Neighbor + 2-opt, gần đúng, nhanh hơn; dùng để so sánh
 * - auto:      exact khi trong giới hạn của Held–Karp, ngược lại heuristic
 */
export const tourAlgorithms = ['auto', 'exact', 'heuristic'] as const;
export const MAX_OPTIMIZE_POINTS = 16;

/** Fixed departure, up to fifteen stops; departure is repeated only in the optimized closed tour. */
export const optimizeRouteRequestSchema = z.object({
  points: z.array(geoPointSchema).min(2).max(MAX_OPTIMIZE_POINTS),
  vehicle: z.enum(['car', 'motorcycle']),
  objective: z.enum(['distance', 'duration']).default('duration'),
  returnToStart: z.boolean().default(false),
  algorithm: z.enum(tourAlgorithms).default('auto'),
}).refine(({ points }) => points.every((point, index) => points.slice(0, index).every((other) => Math.abs(point.lat - other.lat) > 0.000001 || Math.abs(point.lng - other.lng) > 0.000001)), { message: 'Các điểm dừng không được trùng vị trí.' });
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
