import type { NextFunction, Request, Response } from 'express';
import { alongRoutePoiRequestSchema, nearbyPoiRequestSchema, type PoiResult } from '@routetwin/shared';
import { ConcurrencyLimiter } from '../../../shared/http/ConcurrencyLimiter.js';
import { getRequestId } from '../../../shared/http/request-context.js';
import type { SearchPoisAlongRouteUseCase } from '../application/use-cases/SearchPoisAlongRouteUseCase.js';
import type { SearchPoisNearbyUseCase } from '../application/use-cases/SearchPoisNearbyUseCase.js';

/**
 * POST /api/places/along-route và GET /api/places/nearby.
 * Mỗi lượt gọi có thể phát sinh nhiều giao dịch VietMap tính phí, nên giới hạn số lượt chạy đồng thời mỗi instance.
 */
export class PoiSearchController {
  constructor(
    private readonly alongRoute: SearchPoisAlongRouteUseCase,
    private readonly nearby: SearchPoisNearbyUseCase,
    private readonly limiter = new ConcurrencyLimiter(4),
  ) {}

  searchAlongRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = alongRoutePoiRequestSchema.parse(req.body);
      await this.respond(req, res, () => this.alongRoute.execute(input));
    } catch (error) {
      next(error);
    }
  };

  searchNearby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = nearbyPoiRequestSchema.parse(req.query);
      await this.respond(req, res, () => this.nearby.execute(input));
    } catch (error) {
      next(error);
    }
  };

  private async respond(req: Request, res: Response, task: () => Promise<PoiResult[]>): Promise<void> {
    const result = await this.limiter.run(task);
    if (!result) {
      res.setHeader('Retry-After', '5');
      res.status(429).json({
        error: {
          code: 'POI_SEARCH_BUSY',
          message: 'Đang có nhiều yêu cầu tìm địa điểm. Vui lòng thử lại sau vài giây.',
          requestId: getRequestId(req),
        },
      });
      return;
    }
    res.json({ data: result.value });
  }
}
