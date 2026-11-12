import { Router, type RequestHandler } from 'express';
import type { PathfindingController } from './PathfindingController.js';
import type { RerouteController } from './RerouteController.js';
import type { RouteController } from './RouteController.js';

const passThrough: RequestHandler = (_req, _res, next) => next();

/** Các endpoint dưới /api/routes. `calculate` giới hạn tốc độ vì mỗi lượt gọi tới 3 lời gọi VietMap. */
export function createRoutesRouter(
  routeController: RouteController,
  pathfindingController: PathfindingController,
  rerouteController: RerouteController,
  limits: { calculate?: RequestHandler } = {},
): Router {
  const router = Router();
  const limit = limits.calculate ?? passThrough;
  router.post('/calculate', limit, routeController.calculate); // VietMap Route v4
  // Tính lại tuyến từ vị trí hiện tại, tránh sự cố; dùng chung hạn mức vì cũng gọi VietMap nhiều lần.
  router.post('/reroute', limit, rerouteController.handle);
  router.post('/algorithm', pathfindingController.solve); // Dijkstra / A* trên đồ thị OSM
  router.get('/algorithm/graph', pathfindingController.graphInfo); // vùng phủ của đồ thị
  return router;
}
