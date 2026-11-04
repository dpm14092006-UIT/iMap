import express, { Router } from 'express';
import { validateVisionImage, type AiVisionController } from './AiVisionController.js';
import { requireAuth } from '../../../shared/http/require-auth.js';
import type { AuthenticatedRequest } from '../../../shared/http/authenticated-request.js';
import type { ConsumeAiQuotaUseCase } from '../application/use-cases/ConsumeAiQuotaUseCase.js';
import type { RequestHandler } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';

export function createAiVisionRouter(controller: AiVisionController, consumeQuota: ConsumeAiQuotaUseCase): Router {
  const router = Router();
  const imageBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' });
  const enforceQuota: RequestHandler = async (request, _response, next) => {
    const auth = (request as AuthenticatedRequest).auth;
    if (!auth) { next(new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để phân tích ảnh')); return; }
    try { await consumeQuota.execute(auth.accessToken); next(); }
    catch (error) { next(error); }
  };
  router.get('/analyses', requireAuth(), controller.list);
  router.post('/analyze-traffic', requireAuth(), imageBody, validateVisionImage, enforceQuota, controller.analyze);
  router.post('/recognize-sign', requireAuth(), imageBody, validateVisionImage, enforceQuota, controller.recognize);
  return router;
}
