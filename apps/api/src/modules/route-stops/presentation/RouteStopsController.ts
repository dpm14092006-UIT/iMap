import { explorePlacesRequestSchema, routeStopRequestSchema } from '@routetwin/shared';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';
import type { AuthenticatedRequest } from '../../../shared/http/authenticatedRequest.js';
import { ConcurrencyLimiter } from '../../../shared/http/ConcurrencyLimiter.js';
import { getRequestId } from '../../../shared/http/requestContext.js';
import type { FeatureQuota } from '../../../shared/quota/FeatureQuota.js';
import { SupabaseUserFeatureQuota } from '../../../shared/supabase/SupabaseUserFeatureQuota.js';
import type { ExplorePlacesUseCase } from '../application/use-cases/ExplorePlacesUseCase.js';
import type { FindRouteStopsUseCase } from '../application/use-cases/FindRouteStopsUseCase.js';

/**
 * HTTP cho tìm điểm dừng dọc tuyến và khám phá địa điểm bằng trợ lý.
 *
 * Thứ tự xử lý để người dùng chỉ mất lượt khi yêu cầu thực sự được gọi tới provider tốn phí:
 * kiểm tra body (400) → xin chỗ xử lý của instance (429 STOP_SEARCH_BUSY) → trừ hạn mức theo người dùng
 * (429 FEATURE_RATE_LIMIT) → gọi use case.
 */
export class RouteStopsController {
  private readonly limiter = new ConcurrencyLimiter(2);

  constructor(
    private readonly findStops: FindRouteStopsUseCase,
    private readonly explore?: ExplorePlacesUseCase,
    /** Có cấu hình model AI để hiểu yêu cầu tự do hay chỉ dùng bộ từ khóa. */
    private readonly aiConfigured = false,
    private readonly quota: FeatureQuota = new SupabaseUserFeatureQuota(),
  ) {}

  config: RequestHandler = (_req, res) => {
    res.json({ data: { aiConfigured: this.aiConfigured } });
  };

  search: RequestHandler = async (req, res, next) => {
    try {
      const task = this.parse(req);
      const auth = (req as AuthenticatedRequest).auth;
      if (!auth) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để sử dụng tính năng này');
      const result = await this.limiter.run(async () => {
        await this.quota.consume('route_stops', auth.accessToken);
        return task();
      });
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
      if (error instanceof AppError && error.statusCode === 429) res.setHeader('Retry-After', '60');
      next(error);
    }
  };

  /** Kiểm tra body trước mọi việc khác; trả về hàm gọi use case tương ứng. */
  private parse(req: Request): () => Promise<unknown> {
    if (req.path === '/explore' && this.explore) {
      const request = explorePlacesRequestSchema.parse(req.body);
      return () => this.explore!.execute(request);
    }
    const request = routeStopRequestSchema.parse(req.body);
    return () => this.findStops.execute(request);
  }
}
