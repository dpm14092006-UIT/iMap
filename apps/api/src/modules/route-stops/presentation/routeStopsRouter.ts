import { Router } from 'express';
import { requireAuth } from '../../../shared/http/requireAuth.js';
import type { RouteStopsController } from './RouteStopsController.js';

/** Mọi endpoint yêu cầu đăng nhập; tìm kiếm còn trừ hạn mức theo người dùng. */
export function createRouteStopsRouter(controller: RouteStopsController) {
  const router = Router();
  router.use(requireAuth());
  router.get('/config', controller.config);
  // Hạn mức được trừ trong controller, SAU khi kiểm tra body và xin chỗ xử lý (xem RouteStopsController).
  router.post(['/search', '/explore'], controller.search);
  return router;
}
