import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const requestId = req.header('x-request-id') ?? 'unavailable';
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu vượt kích thước endpoint cho phép', requestId } });
    return;
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON trong yêu cầu không hợp lệ', requestId } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: error.flatten(), requestId } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message, requestId } });
    return;
  }
  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ', requestId } });
};
