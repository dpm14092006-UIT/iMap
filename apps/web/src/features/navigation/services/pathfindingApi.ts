import type { PathfindingRequest, PathfindingResult, RoadGraphInfo } from '@routetwin/shared';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';

/** Client cho thuật toán tìm đường tự cài đặt (Dijkstra / A*) trên đồ thị OSM của backend. */
class PathfindingApiClient {
  constructor(private readonly http: HttpClient) {}

  solve(request: PathfindingRequest): Promise<PathfindingResult> {
    return this.http.post<PathfindingResult>('/routes/algorithm', request);
  }

  graphInfo(): Promise<RoadGraphInfo> {
    return this.http.get<RoadGraphInfo>('/routes/algorithm/graph');
  }
}

export const pathfindingApi = new PathfindingApiClient(httpClient);
