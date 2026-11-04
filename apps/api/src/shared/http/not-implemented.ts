import type { RequestHandler } from 'express';
export const notImplemented = (feature: string): RequestHandler => (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: `${feature} chưa được tích hợp trong starter. Xem README.` } });
};
