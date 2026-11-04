import { Router } from 'express';
import type { TrafficController } from './TrafficController.js';
import { requireAuth } from '../../../shared/http/require-auth.js';
export function createTrafficRouter(controller: TrafficController): Router {
  const router = Router();
  router.get('/geojson', controller.geojson);
  router.get('/', controller.list);
  router.post('/', requireAuth(), controller.create);
  router.post('/:id/clearance', requireAuth(), controller.updateClearance);
  return router;
}
