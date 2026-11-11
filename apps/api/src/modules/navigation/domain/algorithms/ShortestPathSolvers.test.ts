import { describe, expect, it } from 'vitest';
import { AStarSolver } from './AStarSolver.js';
import { DijkstraSolver } from './DijkstraSolver.js';
import { haversineMeters } from './haversine.js';
import { RoadGraph, type Vehicle } from './RoadGraph.js';

const both: Vehicle[] = ['car', 'motorcycle'];
const solvers = [new DijkstraSolver(), new AStarSolver()];

/**
 * Lưới n x n node cách nhau ~110 m (0.001 độ), đường hai chiều, tốc độ 30 km/h.
 * Dùng để so sánh số node duyệt giữa Dijkstra và A*.
 */
function gridGraph(size: number): RoadGraph {
  const graph = new RoadGraph();
  const id = (row: number, col: number) => `${row}-${col}`;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++)
      graph.addNode({ id: id(row, col), lat: 10.77 + row * 0.001, lng: 106.69 + col * 0.001 });
  }
  const connect = (a: string, b: string) => {
    // Độ dài cạnh = khoảng cách thật giữa 2 node, giống cách dựng đồ thị từ OSM.
    const distanceMeters = haversineMeters(graph.getNode(a)!, graph.getNode(b)!);
    graph.addDirectedEdge(a, { to: b, distanceMeters, speedKmh: 30, allowedVehicles: both });
    graph.addDirectedEdge(b, { to: a, distanceMeters, speedKmh: 30, allowedVehicles: both });
  };
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (col + 1 < size) connect(id(row, col), id(row, col + 1));
      if (row + 1 < size) connect(id(row, col), id(row + 1, col));
    }
  }
  return graph;
}

/**
 * Đồ thị nhỏ:
 *   A --(200m, chỉ ô tô)--> B --(200m, chỉ ô tô)--> C
 *   A --(900m, cả hai)----------------------------> C
 *   C --(100m, đường một chiều)--> D
 */
function sampleGraph(): RoadGraph {
  const graph = new RoadGraph();
  graph.addNode({ id: 'A', lat: 10.77, lng: 106.69 });
  graph.addNode({ id: 'B', lat: 10.771, lng: 106.691 });
  graph.addNode({ id: 'C', lat: 10.772, lng: 106.692 });
  graph.addNode({ id: 'D', lat: 10.773, lng: 106.692 });
  graph.addDirectedEdge('A', { to: 'B', distanceMeters: 200, speedKmh: 40, allowedVehicles: ['car'] });
  graph.addDirectedEdge('B', { to: 'C', distanceMeters: 200, speedKmh: 40, allowedVehicles: ['car'] });
  graph.addDirectedEdge('A', { to: 'C', distanceMeters: 900, speedKmh: 30, allowedVehicles: both });
  graph.addDirectedEdge('C', { to: 'D', distanceMeters: 100, speedKmh: 30, allowedVehicles: both });
  return graph;
}

describe.each(solvers)('$name', (solver) => {
  it('tìm đường ngắn hơn và tôn trọng loại phương tiện', () => {
    const graph = sampleGraph();
    expect(solver.solve(graph, 'A', 'C', { vehicle: 'car', metric: 'distance' })?.nodeIds).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(solver.solve(graph, 'A', 'C', { vehicle: 'motorcycle', metric: 'distance' })?.nodeIds).toEqual([
      'A',
      'C',
    ]);
  });

  it('tính đúng quãng đường và thời gian (giây)', () => {
    const result = solver.solve(sampleGraph(), 'A', 'C', { vehicle: 'car', metric: 'duration' })!;
    expect(result.distanceMeters).toBe(400);
    expect(result.durationSeconds).toBeCloseTo(400 / (40 / 3.6)); // 36 giây
    expect(result.cost).toBe(result.durationSeconds);
  });

  it('không đi ngược chiều đường một chiều', () => {
    expect(solver.solve(sampleGraph(), 'D', 'C', { vehicle: 'car', metric: 'distance' })).toBeNull();
  });

  it('trả null khi node không tồn tại', () => {
    expect(solver.solve(new RoadGraph(), 'X', 'Y', { vehicle: 'car', metric: 'distance' })).toBeNull();
  });

  it('điểm đầu trùng điểm cuối thì chi phí bằng 0', () => {
    expect(solver.solve(sampleGraph(), 'A', 'A', { vehicle: 'car', metric: 'distance' })).toMatchObject({
      nodeIds: ['A'],
      cost: 0,
    });
  });
});

describe('So sánh Dijkstra và A*', () => {
  it('cùng chi phí tối ưu nhưng A* duyệt ít node hơn', () => {
    const graph = gridGraph(30);
    for (const metric of ['distance', 'duration'] as const) {
      const options = { vehicle: 'car' as const, metric };
      const dijkstra = new DijkstraSolver().solve(graph, '0-0', '20-25', options)!;
      const astar = new AStarSolver().solve(graph, '0-0', '20-25', options)!;
      expect(astar.cost).toBeCloseTo(dijkstra.cost);
      expect(astar.visitedNodes).toBeLessThan(dijkstra.visitedNodes);
    }
  });
});
