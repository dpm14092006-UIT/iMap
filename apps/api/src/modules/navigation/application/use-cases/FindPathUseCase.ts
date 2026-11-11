import type {
  PathAlgorithm,
  PathfindingRequest,
  PathfindingResult,
  PathfindingRun,
  SnappedPoint,
} from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { GraphNode, RoadGraph } from '../../domain/algorithms/RoadGraph.js';
import type { ShortestPathSolver } from '../../domain/algorithms/ShortestPathSolver.js';
import type { RoadGraphSource } from '../ports/RoadGraphSource.js';

/** Điểm chọn cách đường gần nhất quá xa thì coi như nằm ngoài vùng dữ liệu. */
const DEFAULT_MAX_SNAP_METERS = 300;

/**
 * Tìm đường trên đồ thị OSM bằng các thuật toán được yêu cầu (Dijkstra / A*) và đo hiệu năng.
 * Các bước: nạp đồ thị → snap điểm đầu/cuối vào đường → chạy từng thuật toán → trả hình học + số liệu.
 */
export class FindPathUseCase {
  constructor(
    private readonly graphSource: RoadGraphSource,
    private readonly solvers: Record<PathAlgorithm, ShortestPathSolver>,
    private readonly maxSnapMeters = DEFAULT_MAX_SNAP_METERS,
  ) {}

  async execute(request: PathfindingRequest): Promise<PathfindingResult> {
    const { graph } = await this.graphSource.load();
    const start = this.snap(graph, request.from, request.vehicle, 'điểm xuất phát');
    const goal = this.snap(graph, request.to, request.vehicle, 'điểm đến');
    const metric = request.objective;

    const runs = request.algorithms.map((algorithm): PathfindingRun => {
      const started = performance.now();
      const result = this.solvers[algorithm].solve(graph, start.node.id, goal.node.id, {
        vehicle: request.vehicle,
        metric,
      });
      const runtimeMs = performance.now() - started;
      if (!result)
        throw new AppError(422, 'PATH_NOT_FOUND', 'Không tìm được đường giữa hai điểm trong vùng dữ liệu.');
      return {
        algorithm,
        distanceMeters: Math.round(result.distanceMeters),
        durationSeconds: Math.round(result.durationSeconds),
        visitedNodes: result.visitedNodes,
        runtimeMs: Math.round(runtimeMs * 100) / 100,
        coordinates: result.nodeIds.map((id) => {
          const node = graph.getNode(id)!;
          return [node.lng, node.lat]; // GeoJSON [lng, lat]
        }),
      };
    });

    return {
      vehicle: request.vehicle,
      objective: metric,
      snappedFrom: this.toSnappedPoint(start),
      snappedTo: this.toSnappedPoint(goal),
      runs,
    };
  }

  /** Gắn tọa độ vào node gần nhất của mạng đường; báo lỗi nếu quá xa (ngoài vùng dữ liệu). */
  private snap(
    graph: RoadGraph,
    point: { lat: number; lng: number },
    vehicle: PathfindingRequest['vehicle'],
    label: string,
  ) {
    const nearest = graph.nearestNode(point, vehicle);
    if (!nearest || nearest.distanceMeters > this.maxSnapMeters) {
      throw new AppError(
        422,
        'OUTSIDE_GRAPH_COVERAGE',
        `${label[0]!.toUpperCase()}${label.slice(1)} nằm ngoài vùng dữ liệu bản đồ của thuật toán (trung tâm TP.HCM).`,
      );
    }
    return nearest;
  }

  private toSnappedPoint({
    node,
    distanceMeters,
  }: {
    node: GraphNode;
    distanceMeters: number;
  }): SnappedPoint {
    return { lat: node.lat, lng: node.lng, offsetMeters: Math.round(distanceMeters) };
  }
}
