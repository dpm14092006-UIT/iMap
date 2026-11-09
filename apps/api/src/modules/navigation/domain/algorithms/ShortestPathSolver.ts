import type { CostMetric, RoadGraph, Vehicle } from './RoadGraph.js';

export type SearchOptions = { vehicle: Vehicle; metric: CostMetric };

/** Kết quả tìm đường trên đồ thị. */
export type PathResult = {
  /** Danh sách id node theo thứ tự từ điểm đầu tới điểm cuối. */
  nodeIds: string[];
  distanceMeters: number;
  durationSeconds: number;
  /** Tổng chi phí theo tiêu chí đã chọn (mét hoặc giây). */
  cost: number;
  /** Số node đã được "chốt" (lấy ra khỏi hàng đợi) — thước đo khối lượng công việc. */
  visitedNodes: number;
};

/** Interface chung cho mọi thuật toán tìm đường ngắn nhất (Strategy pattern). */
export interface ShortestPathSolver {
  readonly name: string;
  solve(graph: RoadGraph, start: string, goal: string, options: SearchOptions): PathResult | null;
}
