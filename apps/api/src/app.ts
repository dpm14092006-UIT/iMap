import express from 'express';
import cors from 'cors';
import { createContainer } from './composition-root.js';
import { createTrafficRouter } from './modules/traffic/presentation/traffic.routes.js';
import { createPlacesRouter } from './modules/places/presentation/places.routes.js';
import { createRoutesRouter } from './modules/navigation/presentation/routes.routes.js';
import { errorHandler } from './shared/http/error-handler.js';
import { notImplemented } from './shared/http/not-implemented.js';
import { env } from './config/env.js';
export function createApp() {
  const app = express();
  const container = createContainer();
  app.use(cors({origin: env.CORS_ORIGIN}));
  app.use(express.json({limit:'1mb'}));
  app.get('/api/health', (_req,res) => res.json({data:{status:'ok', service:'routetwin-api', routing:env.VIETMAP_API_KEY ? 'vietmap' : 'needs_vietmap_api_key'}}));
  app.use('/api/traffic-reports', createTrafficRouter(container.trafficController));
  app.use('/api/places', createPlacesRouter(container.placeSearchController));
  app.use('/api/routes', createRoutesRouter(container.routeController));
  app.post('/api/routes/algorithm', notImplemented('OSM Dijkstra/A* endpoint'));
  app.post('/api/routes/optimize', notImplemented('Vietmap Matrix + TSP / 2-opt'));
  app.get('/api/my-routes', notImplemented('Supabase saved routes'));
  app.post('/api/ai/analyze-traffic', notImplemented('Gemini Traffic Image Analysis'));
  app.post('/api/ai/recognize-sign', notImplemented('Gemini Traffic Sign Recognition'));
  app.use((_req,res) => res.status(404).json({error:{code:'NOT_FOUND',message:'Không tìm thấy endpoint'}}));
  app.use(errorHandler);
  return app;
}
