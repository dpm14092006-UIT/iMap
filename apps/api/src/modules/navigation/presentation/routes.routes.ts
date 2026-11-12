import { Router, type RequestHandler } from 'express';
import type { PathfindingController } from './PathfindingController.js';
import type { RouteController } from './RouteController.js';

const passThrough: RequestHandler = (_req, _res, next) => next();

/** Các endpoint dưới /api/routes. `calculate` giới hạn tốc độ vì mỗi lượt gọi tới 4 lời gọi VietMap. */
export function createRoutesRouter(
  routeController: RouteController,
  pathfindingController: PathfindingController,
  limits: { calculate?: RequestHandler } = {},
): Router {
  const router = Router();
  router.post('/calculate', limits.calculate ?? passThrough, routeController.calculate); // VietMap Route v4
  router.post('/algorithm', pathfindingController.solve); // Dijkstra / A* trên đồ thị OSM
  router.get('/algorithm/graph', pathfindingController.graphInfo); // vùng phủ của đồ thị
  return router;
}
