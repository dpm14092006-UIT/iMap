import { z } from 'zod';
import { geoPointSchema } from './routes.js';

/**
 * Hợp đồng cho POST /api/routes/algorithm: tìm đường bằng thuật toán tự cài đặt (Dijkstra / A*)
 * trên đồ thị OpenStreetMap của một vùng nhỏ. Khác với /api/routes/calculate (dùng VietMap).
 */
export const pathAlgorithms = ['dijkstra', 'astar'] as const;
export type PathAlgorithm = (typeof pathAlgorithms)[number];

export const pathfindingRequestSchema = z.object({
  from: geoPointSchema,
  to: geoPointSchema,
  vehicle: z.enum(['car', 'motorcycle']),
  objective: z.enum(['distance', 'duration']).default('duration'),
  /** Mặc định chạy cả hai để so sánh. */
  algorithms: z.array(z.enum(pathAlgorithms)).min(1).max(pathAlgorithms.length).default(['dijkstra', 'astar']),
});
export type PathfindingRequest = z.infer<typeof pathfindingRequestSchema>;

/** Điểm người dùng chọn sau khi được "snap" vào node gần nhất trên đồ thị. */
export type SnappedPoint = { lat: number; lng: number; offsetMeters: number };

/** Kết quả của MỘT thuật toán. */
export type PathfindingRun = {
  algorithm: PathAlgorithm;
  distanceMeters: number;
  durationSeconds: number;
  /** Số node đã duyệt (lấy ra khỏi hàng đợi ưu tiên). */
  visitedNodes: number;
  /** Thời gian chạy thuật toán trên server (ms), không gồm thời gian mạng. */
  runtimeMs: number;
  /** Hình học tuyến theo GeoJSON [lng, lat]. */
  coordinates: [number, number][];
};

export type PathfindingResult = {
  vehicle: 'car' | 'motorcycle';
  objective: 'distance' | 'duration';
  snappedFrom: SnappedPoint;
  snappedTo: SnappedPoint;
  runs: PathfindingRun[];
};

/** GET /api/routes/algorithm/graph: thông tin vùng dữ liệu để UI vẽ khung vùng phủ. */
export type RoadGraphInfo = {
  coverage: { south: number; west: number; north: number; east: number };
  nodeCount: number;
  edgeCount: number;
  attribution: string;
};
