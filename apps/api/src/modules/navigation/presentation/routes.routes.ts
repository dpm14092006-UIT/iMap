import { Router } from 'express';
import type { PathfindingController } from './PathfindingController.js';
import type { RouteController } from './RouteController.js';

/** Các endpoint dưới /api/routes. */
export function createRoutesRouter(routeController: RouteController, pathfindingController: PathfindingController): Router {
  const router = Router();
  router.post('/calculate', routeController.calculate); // VietMap Route v4
  router.post('/algorithm', pathfindingController.solve); // Dijkstra / A* trên đồ thị OSM
  router.get('/algorithm/graph', pathfindingController.graphInfo); // vùng phủ của đồ thị
  return router;
}
