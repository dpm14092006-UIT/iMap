import express, { Router } from 'express';
import type { TrafficController } from './TrafficController.js';
import { requireAuth } from '../../../shared/http/require-auth.js';
export function createTrafficRouter(controller: TrafficController): Router {
  const router = Router();
  router.get('/geojson', controller.geojson);
  router.get('/', controller.list);
  router.post('/analyze-image', requireAuth(), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), controller.analyzeImage);
  router.post('/', requireAuth(), controller.create);
  router.post('/:id/clearance', requireAuth(), controller.updateClearance);
  return router;
}
