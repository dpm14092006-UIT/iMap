import { GraphSearchSolver } from './GraphSearchSolver.js';
import { haversineMeters } from '../../../../shared/geo/haversine.js';
import type { RoadGraph } from './RoadGraph.js';
import type { SearchOptions } from './ShortestPathSolver.js';

/**
 * A*: giống Dijkstra nhưng cộng thêm ước lượng h(n) về đích nên tìm "có hướng".
 *
 * Heuristic (luôn không vượt chi phí thật, nên kết quả vẫn tối ưu như Dijkstra):
 *  - distance: khoảng cách đường chim bay tới đích (đường thật không thể ngắn hơn).
 *  - duration: đường chim bay / tốc độ lớn nhất trong đồ thị (không thể đi nhanh hơn).
 */
export class AStarSolver extends GraphSearchSolver {
  readonly name = 'astar';

  protected estimate(graph: RoadGraph, nodeId: string, goalId: string, options: SearchOptions): number {
    const node = graph.getNode(nodeId);
    const goal = graph.getNode(goalId);
    if (!node || !goal) return 0;

    const straightMeters = haversineMeters(node, goal);
    if (options.metric === 'distance') return straightMeters;
    const fastestMetersPerSecond = graph.maxSpeedKmh / 3.6;
    return fastestMetersPerSecond > 0 ? straightMeters / fastestMetersPerSecond : 0;
  }
}
