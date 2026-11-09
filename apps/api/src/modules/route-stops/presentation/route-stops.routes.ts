import { requireAuth } from '../../../shared/http/require-auth.js';
import type { AuthenticatedRequest } from '../../../shared/http/authenticated-request.js';
import type { ExplorePlacesUseCase } from '../application/use-cases/ExplorePlacesUseCase.js';
import { Router } from 'express';
import { routeStopRequestSchema, explorePlacesRequestSchema } from '@routetwin/shared';
import type { FindRouteStopsUseCase } from '../application/use-cases/FindRouteStopsUseCase.js';
/** Small demo guard. For multi-instance production use an authenticated shared rate limiter. */
export function createRouteStopsRouter(findStops: FindRouteStopsUseCase, explore?: ExplorePlacesUseCase) {
  const router = Router();
  router.use(requireAuth());
  const windows = new Map<string, { count: number; until: number }>();
  let active = 0;
  router.post(['/search', '/explore'], async (req, res, next) => {
    const now = Date.now();
    for (const [key, window] of windows) if (window.until <= now) windows.delete(key);
    const key = (req as AuthenticatedRequest).auth!.userId;
    const window = windows.get(key) ?? { count: 0, until: now + 60000 };
    if (active >= 2 || window.count >= 5 || (windows.size >= 1000 && !windows.has(key))) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: { code: 'STOP_SEARCH_BUSY', message: 'Đã có nhiều yêu cầu tìm điểm dừng. Vui lòng thử lại sau một phút.' } });
      return;
    }
    window.count++; windows.set(key, window); active++;
    try {
      if (req.path === '/explore' && explore) {
        res.json({ data: await explore.execute(explorePlacesRequestSchema.parse(req.body)) });
      } else {
        res.json({ data: await findStops.execute(routeStopRequestSchema.parse(req.body)) });
      }
    } catch (error) { next(error); }
    finally { active--; }
  });
  return router;
}
