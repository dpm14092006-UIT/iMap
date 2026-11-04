import { Router } from 'express';
import type { TrafficController } from './TrafficController.js';
export function createTrafficRouter(controller: TrafficController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.post('/:id/clearance', controller.updateClearance);
  return router;
}
