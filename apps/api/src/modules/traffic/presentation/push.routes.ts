import { Router } from 'express';

/** GET /api/push/config: trình duyệt lấy khóa VAPID công khai để đăng ký Web Push. */
export function createPushRouter(config: { enabled: boolean; publicKey?: string }): Router {
  const router = Router();
  router.get('/config', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ data: { enabled: config.enabled, publicKey: config.enabled ? config.publicKey : null } });
  });
  return router;
}
