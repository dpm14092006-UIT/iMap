import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { SupabaseUserFeatureQuota, type QuotaFeature } from '../supabase/SupabaseUserFeatureQuota.js';

export function requireFeatureQuota(
  feature: QuotaFeature,
  quota = new SupabaseUserFeatureQuota(),
): RequestHandler {
  return async (request, response, next) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để sử dụng tính năng này'));
      return;
    }
    try {
      await quota.consume(feature, auth.accessToken);
      next();
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 429) response.setHeader('Retry-After', '60');
      next(error);
    }
  };
}
