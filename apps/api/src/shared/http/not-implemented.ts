import type { RequestHandler } from 'express';
import { getRequestId } from './request-context.js';
export const notImplemented =
  (feature: string): RequestHandler =>
  (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `${feature} chưa được tích hợp trong starter. Xem README.`,
        requestId: getRequestId(req),
      },
    });
  };
