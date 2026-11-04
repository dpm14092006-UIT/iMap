import { Router } from 'express';
import type { PlaceSearchController } from './PlaceSearchController.js';

export function createPlacesRouter(controller: PlaceSearchController): Router {
  const router = Router();
  router.get('/suggest', controller.suggest);
  return router;
}
