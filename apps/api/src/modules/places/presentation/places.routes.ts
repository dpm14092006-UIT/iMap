import { Router } from 'express';
import type { PlaceSearchController } from './PlaceSearchController.js';

export function createPlacesRouter(controller: PlaceSearchController): Router {
  const router = Router();
  router.get('/suggest', controller.suggest); // gợi ý theo từ khóa
  router.get('/details', controller.resolve);
  router.get('/reverse', controller.reverse); // tọa độ -> địa chỉ (dùng khi click bản đồ)
  return router;
}
