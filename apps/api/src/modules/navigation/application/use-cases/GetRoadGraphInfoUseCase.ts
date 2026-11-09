import type { RoadGraphInfo } from '@routetwin/shared';
import type { RoadGraphSource } from '../ports/RoadGraphSource.js';

/** Trả thông tin vùng dữ liệu của đồ thị (để UI vẽ khung vùng phủ và ghi nguồn OSM). */
export class GetRoadGraphInfoUseCase {
  constructor(private readonly graphSource: RoadGraphSource) {}

  async execute(): Promise<RoadGraphInfo> {
    const { graph, coverage, attribution } = await this.graphSource.load();
    return { coverage, nodeCount: graph.nodeCount, edgeCount: graph.edgeCount, attribution };
  }
}
