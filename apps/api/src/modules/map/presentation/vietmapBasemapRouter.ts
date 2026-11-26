import { Router } from 'express';
import { perMinuteRateLimit } from '../../../shared/http/RateLimiter.js';

const VIETMAP_ORIGIN = 'https://maps.vietmap.vn';
const STYLE = /^\/styles\/(?:tm|dm|hm)\/style\.json$/;
const SPRITE = /^\/styles\/(?:tm|dm|hm)\/sprite(?:@2x)?\.(?:json|png)$/;
const FONT = /^\/fonts\/[a-z0-9%,_+ .-]+\/\d{1,5}-\d{1,5}\.pbf$/i;
const TILE =
  /^\/tiles\/(?:vlc(?:-[a-z0-9]+)*\/([0-9]{1,2})\/(\d{1,7})\/(\d{1,7})\.pbf|st\/([0-9]{1,2})\/(\d{1,7})\/(\d{1,7})\.png)$/;

function isAllowedPath(path: string): boolean {
  if (STYLE.test(path) || SPRITE.test(path) || FONT.test(path)) return true;
  const tile = TILE.exec(path);
  if (!tile) return false;
  const offset = tile[1] ? 1 : 4;
  const zoom = Number(tile[offset]);
  const span = 2 ** zoom;
  return zoom <= 22 && Number(tile[offset + 1]) < span && Number(tile[offset + 2]) < span;
}

/** Style JSON includes tile URLs with credentials. Keep template braces and strip their queries. */
function publicStyle(body: string, apiKey: string): unknown {
  return JSON.parse(body, (_key: string, value: unknown) => {
    if (typeof value !== 'string') return value;
    if (value.startsWith(`${VIETMAP_ORIGIN}/maps/`)) return value.split('?')[0];
    return value.replaceAll(apiKey, '');
  });
}

export function createVietmapBasemapRouter(apiKey: string | undefined, request = fetch) {
  const router = Router();
  const rateLimit = perMinuteRateLimit(360);
  router.get(/.*/, rateLimit, async (req, res) => {
    const path = req.path;
    if (!isAllowedPath(path)) {
      res.sendStatus(404);
      return;
    }
    if (!apiKey) {
      res.sendStatus(503);
      return;
    }

    const upstreamUrl = new URL(`/maps${path}`, VIETMAP_ORIGIN);
    upstreamUrl.searchParams.set('apikey', apiKey);
    try {
      const upstream = await request(upstreamUrl, {
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        // MapLibre can distinguish missing individual tiles from access, quota and service failures.
        res.sendStatus([401, 403, 404, 423, 429].includes(upstream.status) ? upstream.status : 502);
        return;
      }

      if (STYLE.test(path)) {
        const style = publicStyle(await upstream.text(), apiKey);
        res.set('Cache-Control', 'public, max-age=300').json(style);
        return;
      }

      const data = Buffer.from(await upstream.arrayBuffer());
      const type = path.endsWith('.png')
        ? 'image/png'
        : path.endsWith('.json')
          ? 'application/json'
          : 'application/x-protobuf';
      res.set('Cache-Control', upstream.headers.get('cache-control') ?? 'public, max-age=3600');
      res.type(type).send(data);
    } catch {
      res.sendStatus(502);
    }
  });
  return router;
}
