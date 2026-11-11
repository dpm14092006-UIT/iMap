import { env } from '../../../config/env.js';
import { requireAuth } from '../../../shared/http/require-auth.js';
import { requireFeatureQuota } from '../../../shared/http/require-feature-quota.js';
import type { ExplorePlacesUseCase } from '../application/use-cases/ExplorePlacesUseCase.js';
import { Router } from 'express';
import { routeStopRequestSchema, explorePlacesRequestSchema } from '@routetwin/shared';
import type { FindRouteStopsUseCase } from '../application/use-cases/FindRouteStopsUseCase.js';
import { getRequestId } from '../../../shared/http/request-context.js';
/** Shared quota limits provider cost across instances; the local counter bounds concurrency per process. */
export function createRouteStopsRouter(findStops: FindRouteStopsUseCase, explore?: ExplorePlacesUseCase) {
  const router = Router();
  router.use(requireAuth());
  router.get('/config', (_req, res) => {
    const aiConfigured = Boolean(
      env.STOP_AI_MODEL &&
      (env.STOP_AI_PROVIDER === 'ollama' || (env.STOP_AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY)),
    );
    res.json({ data: { aiConfigured } });
  });
  let active = 0;
  router.post(['/search', '/explore'], requireFeatureQuota('route_stops'), async (req, res, next) => {
    if (active >= 2) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({
        error: {
          code: 'STOP_SEARCH_BUSY',
          message: 'Đã có nhiều yêu cầu tìm điểm dừng. Vui lòng thử lại sau một phút.',
          requestId: getRequestId(req),
        },
      });
      return;
    }
    active++;
    try {
      if (req.path === '/explore' && explore) {
        res.json({ data: await explore.execute(explorePlacesRequestSchema.parse(req.body)) });
      } else {
        res.json({ data: await findStops.execute(routeStopRequestSchema.parse(req.body)) });
      }
    } catch (error) {
      next(error);
    } finally {
      active--;
    }
  });
  return router;
}
