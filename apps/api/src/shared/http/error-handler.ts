import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { getRequestId } from './request-context.js';

function isTimeout(error: unknown): error is Error {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function isNetworkFailure(error: unknown): error is TypeError {
  return error instanceof TypeError && /fetch failed/i.test(error.message);
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  const requestId = getRequestId(req);
  if (res.headersSent) return next(error);
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu vượt kích thước endpoint cho phép', requestId },
    });
    return;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'JSON trong yêu cầu không hợp lệ', requestId } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: error.flatten(),
        requestId,
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message, requestId } });
    return;
  }
  if (isTimeout(error)) {
    console.error(JSON.stringify({ requestId, name: error.name, message: error.message }));
    res.status(504).json({
      error: {
        code: 'UPSTREAM_TIMEOUT',
        message: 'Một dịch vụ xử lý quá thời gian chờ. Vui lòng thử lại.',
        requestId,
      },
    });
    return;
  }
  if (isNetworkFailure(error)) {
    console.error(JSON.stringify({ requestId, name: error.name, message: error.message }));
    res.status(503).json({
      error: {
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Không thể kết nối dịch vụ xử lý lúc này. Vui lòng thử lại.',
        requestId,
      },
    });
    return;
  }
  console.error(
    JSON.stringify({
      requestId,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ', requestId } });
};
