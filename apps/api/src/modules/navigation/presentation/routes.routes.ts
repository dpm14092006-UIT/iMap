import { Router } from 'express';
import type { RouteController } from './RouteController.js';

export function createRoutesRouter(controller: RouteController): Router {
  const router = Router();
  router.post('/calculate', controller.calculate);
  return router;
}
