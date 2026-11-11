import { Router } from 'express';
import type { OptimizationController } from './OptimizationController.js';

/** Gắn tại /api/routes/optimize. */
export function createOptimizationRouter(controller: OptimizationController): Router {
  const router = Router();
  router.post('/', controller.optimize); // Matrix → Held–Karp hoặc NN + 2-opt → Route
  return router;
}
