import { GraphSearchSolver } from './GraphSearchSolver.js';

/**
 * Dijkstra: luôn mở rộng node có chi phí g(n) nhỏ nhất, không dùng heuristic.
 * Độ phức tạp O((V + E) log V) nhờ min-heap.
 */
export class DijkstraSolver extends GraphSearchSolver {
  readonly name = 'dijkstra';

  protected estimate(): number {
    return 0; // h(n) = 0 → thuật toán trở thành Dijkstra
  }
}
