import { env } from '../../../config/env.js';
import { requireAuth } from '../../../shared/http/require-auth.js';
import { requireFeatureQuota } from '../../../shared/http/require-feature-quota.js';
import type { ExplorePlacesUseCase } from '../application/use-cases/ExplorePlacesUseCase.js';
import { Router } from 'express';
import { routeStopRequestSchema, explorePlacesRequestSchema } from '@routetwin/shared';
import type { FindRouteStopsUseCase } from '../application/use-cases/FindRouteStopsUseCase.js';
import { ConcurrencyLimiter } from '../../../shared/http/ConcurrencyLimiter.js';
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
  const limiter = new ConcurrencyLimiter(2);
  router.post(['/search', '/explore'], requireFeatureQuota('route_stops'), async (req, res, next) => {
    try {
      const result = await limiter.run(async () =>
        req.path === '/explore' && explore
          ? explore.execute(explorePlacesRequestSchema.parse(req.body))
          : findStops.execute(routeStopRequestSchema.parse(req.body)),
      );
      if (!result) {
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
      res.json({ data: result.value });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
