import { createVoiceRouter } from './modules/voice/voice.routes.js';
import { createRouteStopsRouter } from './modules/route-stops/presentation/route-stops.routes.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { createContainer } from './composition-root.js';
import { createTrafficRouter } from './modules/traffic/presentation/traffic.routes.js';
import { createPlacesRouter } from './modules/places/presentation/places.routes.js';
import { createRoutesRouter } from './modules/navigation/presentation/routes.routes.js';
import { errorHandler } from './shared/http/error-handler.js';
import { notImplemented } from './shared/http/not-implemented.js';
import { env, supabaseConfigured } from './config/env.js';
export function createApp(container = createContainer()) {
  const app = express();
  app.use(cors({
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  }));
  app.use((req, res, next) => {
    const requestId = randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    const startedAt = performance.now();
    res.on('finish', () => console.info(JSON.stringify({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    })));
    next();
  });
  app.use(express.json({limit:'32kb'}));
  app.get('/api/health', (_req,res) => res.json({data:{status:'ok', service:'routetwin-api', configured:{supabasePublic:supabaseConfigured, routing:env.VIETMAP_API_KEY ? 'vietmap' : 'needs_vietmap_api_key', trafficImageAi:env.GEMINI_TRAFFIC_AI_ENABLED && Boolean(env.GEMINI_API_KEY)}}}));
  app.use('/api/traffic-reports', createTrafficRouter(container.trafficController));
  app.use('/api/places', createPlacesRouter(container.placeSearchController));
  app.use('/api/route-stops', createRouteStopsRouter(container.findRouteStops, container.explorePlaces));
  app.use('/api/voice', createVoiceRouter());
  app.use('/api/routes', createRoutesRouter(container.routeController, container.pathfindingController));
  app.post('/api/routes/optimize', async (req, res, next) => {
    try { res.json({ data: await container.optimizeRoute.execute(req.body) }); } catch (error) { next(error); }
  });
  app.get('/api/my-routes', notImplemented('Supabase saved routes'));
  app.use((_req,res) => res.status(404).json({error:{code:'NOT_FOUND',message:'Không tìm thấy endpoint'}}));
  app.use(errorHandler);
  return app;
}

// Vercel Express entry point; local main.ts owns listen().
export default createApp();
