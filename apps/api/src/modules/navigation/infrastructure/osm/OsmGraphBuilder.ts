import { haversineMeters } from '../../domain/algorithms/haversine.js';
import { RoadGraph, type Vehicle } from '../../domain/algorithms/RoadGraph.js';
import { allowedVehicles, speedKmh, travelDirection } from './osmRoadRules.js';
import type { OsmExtract, OsmWay } from './osmTypes.js';

/**
 * Dựng RoadGraph (domain) từ dữ liệu OSM đã lọc.
 * Mỗi đoạn giữa 2 node liên tiếp của một way trở thành 1 hoặc 2 cạnh có hướng,
 * tùy theo đường một chiều hay hai chiều đối với từng loại xe.
 */
export class OsmGraphBuilder {
  build(extract: OsmExtract): RoadGraph {
    const graph = new RoadGraph();
    for (const way of extract.ways) this.addWay(graph, way, extract.nodes);
    return graph;
  }

  private addWay(graph: RoadGraph, way: OsmWay, nodes: OsmExtract['nodes']): void {
    const vehicles = allowedVehicles(way.tags);
    if (vehicles.length === 0) return;

    // Xe được đi theo chiều thuận (theo thứ tự node) và chiều ngược.
    const forward: Vehicle[] = vehicles.filter((vehicle) => travelDirection(way.tags, vehicle) !== 'backward');
    const backward: Vehicle[] = vehicles.filter((vehicle) => travelDirection(way.tags, vehicle) !== 'forward');
    const speed = speedKmh(way.tags);
    const name = way.tags.name;

    for (let i = 0; i + 1 < way.nodes.length; i++) {
      const fromId = String(way.nodes[i]);
      const toId = String(way.nodes[i + 1]);
      const from = nodes[fromId];
      const to = nodes[toId];
      if (!from || !to) continue; // thiếu tọa độ (dữ liệu bị cắt ở biên)

      graph.addNode({ id: fromId, lat: from[0], lng: from[1] });
      graph.addNode({ id: toId, lat: to[0], lng: to[1] });
      const distanceMeters = haversineMeters({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] });
      if (distanceMeters === 0) continue;

      const edge = { distanceMeters, speedKmh: speed, ...(name ? { name } : {}) };
      if (forward.length) graph.addDirectedEdge(fromId, { ...edge, to: toId, allowedVehicles: forward });
      if (backward.length) graph.addDirectedEdge(toId, { ...edge, to: fromId, allowedVehicles: backward });
    }
  }
}
