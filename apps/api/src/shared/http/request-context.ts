import type { Request } from 'express';

/** Mã yêu cầu do middleware trong app.ts gắn vào, dùng để đối chiếu log khi báo lỗi. */
export function getRequestId(request: Request): string {
  return request.header('x-request-id') ?? 'unavailable';
}

/** Lấy access token từ header `Authorization: Bearer <token>` (undefined nếu không có). */
export function getBearerToken(request: Request): string | undefined {
  return request.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
}
