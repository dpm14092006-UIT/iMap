import { RoadGraph, type Vehicle } from './RoadGraph.js';
export type PathResult = { path: string[]; distanceMeters: number; visitedVertices: number };
/** Baseline O(V² + E). N1 thay bộ chọn min bằng binary heap khi graph lớn. */
export class DijkstraSolver {
  solve(graph: RoadGraph, start: string, goal: string, vehicle: Vehicle): PathResult | null {
    const dist = new Map<string, number>([[start, 0]]);
    const previous = new Map<string, string>();
    const open = new Set<string>([start]);
    const closed = new Set<string>();
    while (open.size > 0) {
      let current: string | undefined;
      for (const v of open) if (current === undefined || (dist.get(v) ?? Infinity) < (dist.get(current) ?? Infinity)) current = v;
      if (current === undefined) break;
      open.delete(current);
      if (closed.has(current)) continue;
      closed.add(current);
      if (current === goal) {
        const path = [goal];
        while (path[0] !== start) {
          const predecessor = previous.get(path[0]!);
          if (!predecessor) return null;
          path.unshift(predecessor);
        }
        return { path, distanceMeters: dist.get(goal)!, visitedVertices: closed.size };
      }
      for (const edge of graph.neighbors(current, vehicle)) {
        if (closed.has(edge.to)) continue;
        const next = (dist.get(current) ?? Infinity) + edge.distanceMeters;
        if (next < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, next);
          previous.set(edge.to, current);
          open.add(edge.to);
        }
      }
    }
    return null;
  }
}
