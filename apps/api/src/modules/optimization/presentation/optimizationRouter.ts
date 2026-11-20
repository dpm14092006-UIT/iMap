import { Router, type RequestHandler } from 'express';
import type { OptimizationController } from './OptimizationController.js';

const passThrough: RequestHandler = (_req, _res, next) => next();

/** Gắn tại /api/routes/optimize. Giới hạn tốc độ vì mỗi lượt gọi VietMap Matrix rồi Route (tính phí). */
export function createOptimizationRouter(
  controller: OptimizationController,
  rateLimit: RequestHandler = passThrough,
): Router {
  const router = Router();
  router.post('/', rateLimit, controller.optimize); // Matrix → Held–Karp hoặc NN + 2-opt → Route
  return router;
}
