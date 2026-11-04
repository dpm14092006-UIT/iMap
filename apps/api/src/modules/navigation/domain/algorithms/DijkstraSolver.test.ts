import { describe, expect, it } from 'vitest';
import { DijkstraSolver } from './DijkstraSolver.js';
import { RoadGraph } from './RoadGraph.js';
describe('DijkstraSolver – đồ thị mẫu, không phải đường thực tế', () => {
  it('tìm đường ngắn hơn và tôn trọng loại phương tiện', () => {
    const graph = new RoadGraph();
    graph.addDirectedEdge('A', {to:'B', distanceMeters:2, allowedVehicles:['car']});
    graph.addDirectedEdge('B', {to:'C', distanceMeters:2, allowedVehicles:['car']});
    graph.addDirectedEdge('A', {to:'C', distanceMeters:9, allowedVehicles:['car','motorcycle']});
    const solver = new DijkstraSolver();
    expect(solver.solve(graph, 'A', 'C', 'car')?.distanceMeters).toBe(4);
    expect(solver.solve(graph, 'A', 'C', 'motorcycle')?.distanceMeters).toBe(9);
  });
  it('trả null khi không có đường', () => {
    expect(new DijkstraSolver().solve(new RoadGraph(), 'X', 'Y', 'car')).toBeNull();
  });
});
