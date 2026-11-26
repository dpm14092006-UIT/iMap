import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createContainer } from './compositionRoot.js';
import { env, supabaseConfigured, webPushConfigured } from './config/env.js';
import { createVietmapBasemapRouter } from './modules/map/presentation/vietmapBasemapRouter.js';
import { createVnsdiBasemapRouter } from './modules/map/presentation/vnsdiBasemapRouter.js';
import { createPushRouter } from './modules/traffic/presentation/pushRouter.js';
import { createRoutesRouter } from './modules/navigation/presentation/navigationRouter.js';
import { createOptimizationRouter } from './modules/optimization/presentation/optimizationRouter.js';
import { createPlacesRouter } from './modules/places/presentation/placesRouter.js';
import { createRouteStopsRouter } from './modules/route-stops/presentation/routeStopsRouter.js';
import { createTrafficRouter } from './modules/traffic/presentation/trafficRouter.js';
import { errorHandler } from './shared/http/errorHandler.js';
import { notImplemented } from './shared/http/notImplemented.js';
import { getRequestId } from './shared/http/requestContext.js';

/** Tạo ứng dụng Express: header bảo mật, log theo request, CORS rồi tới các router của từng module. */
export function createApp(container = createContainer()) {
  const app = express();
  app.disable('x-powered-by');
  // Sau reverse proxy (Vercel...) cần tin proxy để `req.ip` là IP máy khách thật cho rate limit.
  if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use((req, res, next) => {
    const requestId = randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    const startedAt = performance.now();
    res.on('finish', () =>
      console.info(
        JSON.stringify({
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - startedAt),
        }),
      ),
    );
    next();
  });
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: [
        'X-Request-Id',
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'Retry-After',
      ],
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_req, res) =>
    res.json({
      data: {
        status: 'ok',
        service: 'routetwin-api',
        configured: {
          supabasePublic: supabaseConfigured,
          routing: env.VIETMAP_API_KEY ? 'vietmap' : 'needs_vietmap_api_key',
          vnsdiBasemap: Boolean(env.VNSDI_BASEMAP_TOKEN),
          trafficImageAi: env.GEMINI_TRAFFIC_AI_ENABLED && Boolean(env.GEMINI_API_KEY),
          webPush: webPushConfigured,
        },
      },
    }),
  );
  app.use('/api/map/vietmap', createVietmapBasemapRouter(env.VIETMAP_TILEMAP_API_KEY ?? env.VIETMAP_API_KEY));
  app.use('/api/map/vnsdi', createVnsdiBasemapRouter(env.VNSDI_BASEMAP_TOKEN));
  app.use('/api/traffic-reports', createTrafficRouter(container.trafficController));
  app.use('/api/push', createPushRouter({ enabled: webPushConfigured, publicKey: env.WEB_PUSH_PUBLIC_KEY }));
  app.use(
    '/api/places',
    createPlacesRouter(container.placeSearchController, container.poiSearchController, {
      places: container.rateLimits.places,
      poi: container.rateLimits.poi,
    }),
  );
  app.use('/api/route-stops', createRouteStopsRouter(container.routeStopsController));
  app.use(
    '/api/routes/optimize',
    createOptimizationRouter(container.optimizationController, container.rateLimits.optimize),
  );
  app.use(
    '/api/routes',
    createRoutesRouter(
      container.routeController,
      container.pathfindingController,
      container.rerouteController,
      { calculate: container.rateLimits.routes, compare: container.rateLimits.routeComparison },
      container.routeComparisonController,
    ),
  );
  app.get('/api/my-routes', notImplemented('Supabase saved routes'));
  app.use((req, res) =>
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Không tìm thấy endpoint',
        requestId: getRequestId(req),
      },
    }),
  );
  app.use(errorHandler);
  return app;
}
