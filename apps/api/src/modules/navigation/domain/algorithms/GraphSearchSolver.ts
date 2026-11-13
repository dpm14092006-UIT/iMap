import { MinHeap } from './MinHeap.js';
import { edgeCost, type GraphEdge, type RoadGraph } from './RoadGraph.js';
import type { PathResult, SearchOptions, ShortestPathSolver } from './ShortestPathSolver.js';

/** Ghi nhớ node trước đó và cạnh đã dùng để tới một node (để dựng lại đường đi). */
type Step = { from: string; edge: GraphEdge };

/**
 * Khung chung của Dijkstra và A* (Template Method pattern).
 *
 * Cả hai thuật toán đều lấy ra node có f(n) = g(n) + h(n) nhỏ nhất:
 *  - g(n): chi phí thực tế từ điểm đầu tới n.
 *  - h(n): ước lượng chi phí còn lại từ n tới đích (do lớp con định nghĩa).
 * Dijkstra là trường hợp h(n) = 0. A* dùng h(n) > 0 để ưu tiên hướng về đích nên duyệt ít node hơn.
 */
export abstract class GraphSearchSolver implements ShortestPathSolver {
  abstract readonly name: string;

  /** Heuristic h(n). Phải KHÔNG vượt quá chi phí thật để kết quả vẫn tối ưu. */
  protected abstract estimate(
    graph: RoadGraph,
    nodeId: string,
    goalId: string,
    options: SearchOptions,
  ): number;

  solve(graph: RoadGraph, start: string, goal: string, options: SearchOptions): PathResult | null {
    if (!graph.hasNode(start) || !graph.hasNode(goal)) return null;

    const gScore = new Map<string, number>([[start, 0]]); // chi phí tốt nhất đã biết tới mỗi node
    const cameFrom = new Map<string, Step>();
    const closed = new Set<string>(); // node đã chốt chi phí nhỏ nhất
    const open = new MinHeap<string>(); // hàng đợi theo f = g + h
    open.push(start, this.estimate(graph, start, goal, options));

    while (open.size > 0) {
      const current = open.pop()!;
      if (closed.has(current)) continue; // bản sao cũ trong heap (lazy deletion)
      closed.add(current);

      if (current === goal) return this.buildResult(start, goal, cameFrom, closed.size, options);

      const currentCost = gScore.get(current)!;
      for (const edge of graph.neighbors(current, options.vehicle)) {
        if (closed.has(edge.to)) continue;
        const tentative = currentCost + edgeCost(edge, options.metric);
        // "Relax" cạnh: chỉ cập nhật khi tìm được đường rẻ hơn tới edge.to.
        if (tentative < (gScore.get(edge.to) ?? Infinity)) {
          gScore.set(edge.to, tentative);
          cameFrom.set(edge.to, { from: current, edge });
          open.push(edge.to, tentative + this.estimate(graph, edge.to, goal, options));
        }
      }
    }
    return null; // không có đường đi cho loại xe này
  }

  /** Đi ngược từ đích về điểm đầu theo cameFrom, đồng thời cộng quãng đường và thời gian. */
  private buildResult(
    start: string,
    goal: string,
    cameFrom: Map<string, Step>,
    visitedNodes: number,
    options: SearchOptions,
  ): PathResult {
    const nodeIds = [goal];
    let distanceMeters = 0;
    let durationSeconds = 0;
    let cursor = goal;
    while (cursor !== start) {
      const step = cameFrom.get(cursor)!;
      distanceMeters += edgeCost(step.edge, 'distance');
      durationSeconds += edgeCost(step.edge, 'duration');
      nodeIds.push(step.from);
      cursor = step.from;
    }
    nodeIds.reverse();
    return {
      nodeIds,
      distanceMeters,
      durationSeconds,
      cost: options.metric === 'distance' ? distanceMeters : durationSeconds,
      visitedNodes,
    };
  }
}
