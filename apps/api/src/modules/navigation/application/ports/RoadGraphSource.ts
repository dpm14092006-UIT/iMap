import type { RoadGraph } from '../../domain/algorithms/RoadGraph.js';

export type GraphCoverage = { south: number; west: number; north: number; east: number };

/** Đồ thị đã nạp kèm thông tin vùng phủ và nguồn dữ liệu. */
export type LoadedRoadGraph = {
  graph: RoadGraph;
  coverage: GraphCoverage;
  attribution: string;
};

/** Port nạp đồ thị đường. Use case không biết dữ liệu đến từ file OSM, database hay nguồn khác. */
export interface RoadGraphSource {
  load(): Promise<LoadedRoadGraph>;
}
