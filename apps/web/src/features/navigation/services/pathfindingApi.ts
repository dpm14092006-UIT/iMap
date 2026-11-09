import type { PathfindingRequest, PathfindingResult, RoadGraphInfo } from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';

/** Client cho thuật toán tìm đường tự cài đặt (Dijkstra / A*) trên đồ thị OSM của backend. */
export const pathfindingApi = {
  solve: (request: PathfindingRequest) =>
    apiRequest<PathfindingResult>('/routes/algorithm', { method: 'POST', body: JSON.stringify(request) }),

  graphInfo: () => apiRequest<RoadGraphInfo>('/routes/algorithm/graph'),
};
