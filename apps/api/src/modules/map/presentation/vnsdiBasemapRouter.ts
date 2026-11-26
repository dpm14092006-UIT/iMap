import { Router } from 'express';
import { perMinuteRateLimit } from '../../../shared/http/RateLimiter.js';

/**
 * Bản đồ nền của Cổng thông tin không gian địa lý Việt Nam (VNSDI, Cục Đo đạc, Bản đồ và Thông tin
 * địa lý Việt Nam). Dịch vụ ArcGIS MapServer dạng ô ảnh PNG 256px, lưới Web Mercator (EPSG:3857),
 * mức 0–18, cần token. Token giữ ở máy chủ; trình duyệt chỉ gọi `/api/map/vnsdi/...`.
 */
export const VNSDI_ORIGIN = 'https://vnsdi.mae.gov.vn';
export const VNSDI_SERVICES = {
  /** Bản đồ hành chính Việt Nam (34 tỉnh, thành; Hoàng Sa, Trường Sa). */
  admin: 'BanDoHanhChinhVietNam',
  /** Bản đồ nền địa hình (bóng địa hình NASA, JAXA). */
  terrain: 'BanDoDiaHinh',
} as const;
export const VNSDI_MAX_ZOOM = 18;

const TILE = /^\/(admin|terrain)\/tile\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})$/;

export function createVnsdiBasemapRouter(token: string | undefined, request = fetch) {
  const router = Router();
  const rateLimit = perMinuteRateLimit(600);
  router.get(/.*/, rateLimit, async (req, res) => {
    const match = TILE.exec(req.path);
    const zoom = Number(match?.[2]);
    const span = 2 ** zoom;
    if (!match || zoom > VNSDI_MAX_ZOOM || Number(match[3]) >= span || Number(match[4]) >= span) {
      res.sendStatus(404);
      return;
    }
    if (!token) {
      res.sendStatus(503);
      return;
    }

    const service = VNSDI_SERVICES[match[1] as keyof typeof VNSDI_SERVICES];
    const upstreamUrl = new URL(
      `/basemap/rest/services/${service}/MapServer/tile/${zoom}/${match[3]}/${match[4]}`,
      VNSDI_ORIGIN,
    );
    upstreamUrl.searchParams.set('token', token);
    try {
      const upstream = await request(upstreamUrl, {
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
      });
      const type = upstream.headers.get('content-type') ?? '';
      // ArcGIS trả lỗi token (499/498) dưới dạng JSON với HTTP 200, nên phải kiểm tra loại nội dung.
      if (!upstream.ok || !type.startsWith('image/')) {
        await upstream.body?.cancel();
        res.sendStatus(upstream.ok ? 401 : upstream.status === 404 ? 404 : 502);
        return;
      }
      const data = Buffer.from(await upstream.arrayBuffer());
      res.set('Cache-Control', 'public, max-age=86400');
      res.type(type).send(data);
    } catch {
      res.sendStatus(502);
    }
  });
  return router;
}
