import { Router } from 'express';
import type { PlaceSearchController } from './PlaceSearchController.js';
import type { PoiSearchController } from './PoiSearchController.js';

export function createPlacesRouter(
  controller: PlaceSearchController,
  poiController: PoiSearchController,
): Router {
  const router = Router();
  router.get('/suggest', controller.suggest); // gợi ý theo từ khóa
  router.get('/details', controller.resolve);
  router.get('/reverse', controller.reverse); // tọa độ -> địa chỉ (dùng khi click bản đồ)
  router.post('/along-route', poiController.searchAlongRoute); // địa điểm thật dọc tuyến
  router.get('/nearby', poiController.searchNearby); // địa điểm thật quanh một tâm
  return router;
}
