import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { SupabaseUserFeatureQuota, type QuotaFeature } from '../supabase/SupabaseUserFeatureQuota.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

/** Trừ một lượt trong hạn mức theo phút của người dùng cho một tính năng tốn phí; hết lượt thì trả 429. */
class FeatureQuotaGuard {
  constructor(
    private readonly feature: QuotaFeature,
    private readonly quota = new SupabaseUserFeatureQuota(),
  ) {}

  readonly handler: RequestHandler = async (request, response, next) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để sử dụng tính năng này'));
      return;
    }
    try {
      await this.quota.consume(this.feature, auth.accessToken);
      next();
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 429) response.setHeader('Retry-After', '60');
      next(error);
    }
  };
}

export function requireFeatureQuota(feature: QuotaFeature, quota?: SupabaseUserFeatureQuota): RequestHandler {
  return new FeatureQuotaGuard(feature, quota).handler;
}
