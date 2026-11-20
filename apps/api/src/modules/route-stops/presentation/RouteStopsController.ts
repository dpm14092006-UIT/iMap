import { explorePlacesRequestSchema, routeStopRequestSchema } from '@routetwin/shared';
import type { RequestHandler } from 'express';
import { ConcurrencyLimiter } from '../../../shared/http/ConcurrencyLimiter.js';
import { getRequestId } from '../../../shared/http/requestContext.js';
import type { ExplorePlacesUseCase } from '../application/use-cases/ExplorePlacesUseCase.js';
import type { FindRouteStopsUseCase } from '../application/use-cases/FindRouteStopsUseCase.js';

/**
 * HTTP cho tìm điểm dừng dọc tuyến và khám phá địa điểm bằng trợ lý.
 * Hạn mức dùng chung giữa các instance nằm ở middleware; lớp này giới hạn số yêu cầu song song mỗi process.
 */
export class RouteStopsController {
  private readonly limiter = new ConcurrencyLimiter(2);

  constructor(
    private readonly findStops: FindRouteStopsUseCase,
    private readonly explore?: ExplorePlacesUseCase,
    /** Có cấu hình model AI để hiểu yêu cầu tự do hay chỉ dùng bộ từ khóa. */
    private readonly aiConfigured = false,
  ) {}

  config: RequestHandler = (_req, res) => {
    res.json({ data: { aiConfigured: this.aiConfigured } });
  };

  search: RequestHandler = async (req, res, next) => {
    try {
      const result = await this.limiter.run(async () =>
        req.path === '/explore' && this.explore
          ? this.explore.execute(explorePlacesRequestSchema.parse(req.body))
          : this.findStops.execute(routeStopRequestSchema.parse(req.body)),
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
  };
}
