export type Vehicle = 'car' | 'motorcycle';
export type GraphEdge = { to: string; distanceMeters: number; allowedVehicles: Vehicle[] };
export class RoadGraph {
  private readonly adjacency = new Map<string, GraphEdge[]>();
  addDirectedEdge(from: string, edge: GraphEdge): void {
    if (edge.distanceMeters < 0 || !Number.isFinite(edge.distanceMeters)) throw new RangeError('Trọng số không hợp lệ');
    this.adjacency.set(from, [...(this.adjacency.get(from) ?? []), edge]);
    if (!this.adjacency.has(edge.to)) this.adjacency.set(edge.to, []);
  }
  neighbors(from: string, vehicle: Vehicle): GraphEdge[] {
    return (this.adjacency.get(from) ?? []).filter(x => x.allowedVehicles.includes(vehicle));
  }
  vertices(): string[] { return [...this.adjacency.keys()]; }
}
