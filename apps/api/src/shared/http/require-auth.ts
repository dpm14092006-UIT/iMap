import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { SupabaseClientFactory } from '../supabase/SupabaseClientFactory.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { getBearerToken } from './request-context.js';

/**
 * Xác minh phiên đăng nhập Supabase của từng yêu cầu (không tin token do client tự khai).
 * Từ chối khách chưa đăng nhập, phiên hết hạn và tài khoản ẩn danh; thành công thì gắn `request.auth`.
 */
class SessionAuthenticator {
  constructor(private readonly clients = new SupabaseClientFactory()) {}

  readonly handler: RequestHandler = async (request, _response, next) => {
    const token = getBearerToken(request);
    if (!token) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để thực hiện thao tác này'));
      return;
    }
    try {
      const { data, error } = await this.clients.create().auth.getUser(token);
      if (error) {
        next(this.toAuthError(Number((error as { status?: number }).status ?? 0)));
        return;
      }
      if (!data.user) {
        next(this.toAuthError(401));
        return;
      }
      if (data.user.is_anonymous) {
        next(
          new AppError(
            403,
            'ACCOUNT_REQUIRED',
            'Vui lòng đăng ký tài khoản và đăng nhập để sử dụng tính năng này',
          ),
        );
        return;
      }
      (request as AuthenticatedRequest).auth = { userId: data.user.id, accessToken: token };
      next();
    } catch {
      next(this.toAuthError(0));
    }
  };

  /** Token bị từ chối (400/401/403) là lỗi phiên; mọi trường hợp khác là dịch vụ xác thực không sẵn sàng. */
  private toAuthError(upstreamStatus: number): AppError {
    return [400, 401, 403].includes(upstreamStatus)
      ? new AppError(401, 'INVALID_SESSION', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
      : new AppError(503, 'AUTH_UNAVAILABLE', 'Không thể xác minh tài khoản lúc này');
  }
}

/** Middleware yêu cầu đăng nhập bằng tài khoản thật. */
export function requireAuth(clients = new SupabaseClientFactory()): RequestHandler {
  return new SessionAuthenticator(clients).handler;
}
