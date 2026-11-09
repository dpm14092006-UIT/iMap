import { haversineMeters } from './haversine.js';
import { largestStronglyConnectedComponent } from './stronglyConnected.js';

export type Vehicle = 'car' | 'motorcycle';
/** Tiêu chí tối ưu: ngắn nhất theo quãng đường hay nhanh nhất theo thời gian. */
export type CostMetric = 'distance' | 'duration';

/** Một giao lộ / điểm trên đường, có tọa độ thật. */
export type GraphNode = { id: string; lat: number; lng: number };

/** Cạnh có hướng giữa hai node (một đoạn đường). */
export type GraphEdge = {
  to: string;
  distanceMeters: number;
  /** Tốc độ ước tính khi đường thông thoáng (km/h). */
  speedKmh: number;
  /** Loại xe được phép đi theo chiều này. */
  allowedVehicles: Vehicle[];
  name?: string;
};

/** Chi phí đi qua một cạnh theo tiêu chí: mét (distance) hoặc giây (duration). */
export function edgeCost(edge: GraphEdge, metric: CostMetric): number {
  return metric === 'distance' ? edge.distanceMeters : edge.distanceMeters / (edge.speedKmh / 3.6);
}

/**
 * Đồ thị đường có hướng (danh sách kề).
 * Đường hai chiều được biểu diễn bằng 2 cạnh ngược nhau; đường một chiều chỉ có 1 cạnh.
 */
export class RoadGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly adjacency = new Map<string, GraphEdge[]>();
  /** Cache mạng đường chính theo loại xe (xem mainNetwork). */
  private readonly mainNetworks = new Map<Vehicle, Set<string>>();
  private edges = 0;
  /** Tốc độ lớn nhất trong đồ thị, dùng cho heuristic thời gian của A*. */
  private fastestSpeedKmh = 0;

  addNode(node: GraphNode): void {
    if (!Number.isFinite(node.lat) || !Number.isFinite(node.lng)) throw new RangeError(`Tọa độ node ${node.id} không hợp lệ`);
    if (this.nodes.has(node.id)) return;
    this.nodes.set(node.id, node);
    this.adjacency.set(node.id, []);
  }

  /** Thêm cạnh from -> edge.to. Cả hai node phải được addNode trước. */
  addDirectedEdge(from: string, edge: GraphEdge): void {
    if (!this.nodes.has(from) || !this.nodes.has(edge.to)) throw new RangeError(`Cạnh ${from} -> ${edge.to} nối tới node chưa tồn tại`);
    if (!Number.isFinite(edge.distanceMeters) || edge.distanceMeters < 0) throw new RangeError('Độ dài cạnh không hợp lệ');
    if (!Number.isFinite(edge.speedKmh) || edge.speedKmh <= 0) throw new RangeError('Tốc độ cạnh phải lớn hơn 0');
    if (edge.allowedVehicles.length === 0) return; // không xe nào đi được thì bỏ qua

    this.adjacency.get(from)!.push(edge);
    this.mainNetworks.clear(); // đồ thị đổi thì mạng chính phải tính lại
    this.edges += 1;
    this.fastestSpeedKmh = Math.max(this.fastestSpeedKmh, edge.speedKmh);
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /** Các cạnh đi ra từ node mà loại xe này được phép đi. */
  neighbors(from: string, vehicle: Vehicle): GraphEdge[] {
    return (this.adjacency.get(from) ?? []).filter((edge) => edge.allowedVehicles.includes(vehicle));
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges;
  }

  get maxSpeedKmh(): number {
    return this.fastestSpeedKmh;
  }

  /**
   * Tập node thuộc mạng đường chính của loại xe (thành phần liên thông mạnh lớn nhất).
   * Tính một lần rồi lưu lại; bị xóa khi đồ thị thay đổi.
   */
  mainNetwork(vehicle: Vehicle): Set<string> {
    let network = this.mainNetworks.get(vehicle);
    if (!network) {
      network = largestStronglyConnectedComponent([...this.nodes.keys()], (id) => this.neighbors(id, vehicle).map((edge) => edge.to));
      this.mainNetworks.set(vehicle, network);
    }
    return network;
  }

  /**
   * Tìm node gần tọa độ nhất trong mạng đường chính của loại xe (snap điểm vào đường).
   * Chỉ chọn node trong mạng chính nên hai điểm bất kỳ đã snap luôn có đường đi tới nhau.
   * Quét tuyến tính O(V) — đủ nhanh cho đồ thị một khu vực nhỏ.
   */
  nearestNode(point: { lat: number; lng: number }, vehicle: Vehicle): { node: GraphNode; distanceMeters: number } | null {
    let best: { node: GraphNode; distanceMeters: number } | null = null;
    for (const id of this.mainNetwork(vehicle)) {
      const node = this.nodes.get(id)!;
      const distanceMeters = haversineMeters(point, node);
      if (!best || distanceMeters < best.distanceMeters) best = { node, distanceMeters };
    }
    return best;
  }
}
