import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { SupabaseClientFactory } from '../supabase/SupabaseClientFactory.js';
import { AppError } from '../errors/AppError.js';

export function requireAuth(clientFactory = new SupabaseClientFactory()): RequestHandler {
  return async (request, _response, next) => {
    const token = request.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để thực hiện thao tác này'));
      return;
    }
    try {
      const { data, error } = await clientFactory.create().auth.getUser(token);
      if (error) {
        const upstreamStatus = Number((error as { status?: number }).status ?? 0);
        next([400, 401, 403].includes(upstreamStatus)
          ? new AppError(401, 'INVALID_SESSION', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
          : new AppError(503, 'AUTH_UNAVAILABLE', 'Không thể xác minh tài khoản lúc này'));
        return;
      }
      if (!data.user) {
        next(new AppError(401, 'INVALID_SESSION', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'));
        return;
      }
      (request as AuthenticatedRequest).auth = { userId: data.user.id, accessToken: token };
      next();
    } catch {
      next(new AppError(503, 'AUTH_UNAVAILABLE', 'Không thể xác minh tài khoản lúc này'));
    }
  };
}
