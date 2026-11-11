import { Router } from 'express';
import type { PathfindingController } from './PathfindingController.js';
import type { RerouteController } from './RerouteController.js';
import type { RouteController } from './RouteController.js';

/** Các endpoint dưới /api/routes. */
export function createRoutesRouter(
  routeController: RouteController,
  pathfindingController: PathfindingController,
  rerouteController: RerouteController,
): Router {
  const router = Router();
  router.post('/calculate', routeController.calculate); // VietMap Route v4
  router.post('/reroute', rerouteController.handle); // tính lại tuyến từ vị trí hiện tại, tránh sự cố
  router.post('/algorithm', pathfindingController.solve); // Dijkstra / A* trên đồ thị OSM
  router.get('/algorithm/graph', pathfindingController.graphInfo); // vùng phủ của đồ thị
  return router;
}
