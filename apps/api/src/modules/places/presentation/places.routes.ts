import { Router, type RequestHandler } from 'express';
import type { PlaceSearchController } from './PlaceSearchController.js';
import type { PoiSearchController } from './PoiSearchController.js';

const passThrough: RequestHandler = (_req, _res, next) => next();

/** `places`: gợi ý/chi tiết/reverse; `poi`: tìm địa điểm dọc tuyến/quanh đây. Giới hạn chạy trước validation. */
export type PlacesRateLimits = { places?: RequestHandler; poi?: RequestHandler };

export function createPlacesRouter(
  controller: PlaceSearchController,
  poiController: PoiSearchController,
  limits: PlacesRateLimits = {},
): Router {
  const router = Router();
  const places = limits.places ?? passThrough;
  const poi = limits.poi ?? passThrough;
  router.get('/suggest', places, controller.suggest); // gợi ý theo từ khóa
  router.get('/details', places, controller.resolve);
  router.get('/reverse', places, controller.reverse); // tọa độ -> địa chỉ (dùng khi click bản đồ)
  router.post('/along-route', poi, poiController.searchAlongRoute); // địa điểm thật dọc tuyến
  router.get('/nearby', poi, poiController.searchNearby); // địa điểm thật quanh một tâm
  return router;
}
