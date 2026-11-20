import { Router } from 'express';
import { requireAuth } from '../../../shared/http/requireAuth.js';
import { requireFeatureQuota } from '../../../shared/http/requireFeatureQuota.js';
import type { RouteStopsController } from './RouteStopsController.js';

/** Mọi endpoint yêu cầu đăng nhập; tìm kiếm còn trừ hạn mức theo người dùng. */
export function createRouteStopsRouter(controller: RouteStopsController) {
  const router = Router();
  router.use(requireAuth());
  router.get('/config', controller.config);
  router.post(['/search', '/explore'], requireFeatureQuota('route_stops'), controller.search);
  return router;
}
