import { SupabaseClientFactory } from '../../../shared/supabase/SupabaseClientFactory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { once } from 'node:events';
import type { RouteResult } from '@routetwin/shared';
import { createRouteStopsRouter } from './route-stops.routes.js';
import { FindRouteStopsUseCase } from '../application/use-cases/FindRouteStopsUseCase.js';
import { KeywordStopIntentParser } from '../infrastructure/providers/KeywordStopIntentParser.js';
import { errorHandler } from '../../../shared/http/error-handler.js';
const servers: Server[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });
const baseline: RouteResult = { source: 'vietmap', distanceMeters: 10000, durationSeconds: 1000, coordinates: [[106.7, 10.7], [106.8, 10.7]], instructions: [] };
async function start() {
  vi.spyOn(SupabaseClientFactory.prototype, 'create').mockReturnValue({ auth: { getUser: vi.fn(async (token: string) => token === 'test-session' ? { data: { user: { id: 'member-1' } }, error: null } : { data: { user: null }, error: { status: 401 } }) } } as unknown as ReturnType<SupabaseClientFactory['create']>);
  const app = express(); app.use(express.json());
  const usecase = new FindRouteStopsUseCase({ calculate: async ({ points }) => points.length === 2 ? baseline : { ...baseline, distanceMeters: 10500, durationSeconds: 1120 } }, { search: async () => [{ id: 'osm-node-1', name: 'Trạm thử nghiệm', address: 'Fixture only', category: 'fuel', lat: 10.701, lng: 106.75, osmUrl: 'https://www.openstreetmap.org/node/1', openingHours: null }] }, new KeywordStopIntentParser());
  app.use('/api/route-stops', createRouteStopsRouter(usecase)); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); servers.push(server); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  return `http://127.0.0.1:${address.port}/api/route-stops/search`;
}
const body = { points: [{ lat: 10.7, lng: 106.7 }, { lat: 10.7, lng: 106.8 }], vehicle: 'motorcycle', query: 'Tìm trạm xăng, thêm tối đa 1 km' };
const post = (url: string, data: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-session' }, body: JSON.stringify(data) });
describe('route stop HTTP flow with controlled provider fixtures', () => {
  it('returns routing facts and geometry in the existing API envelope', async () => {
    const response = await post(await start(), body); expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.candidates[0]).toMatchObject({ extraDistanceMeters: 500, extraDurationSeconds: 120, insertAfterIndex: 0, route: { source: 'vietmap' } });
    expect(data.interpretation.source).toBe('rules');
  });
  it('rejects invalid coordinates and more than two base waypoints', async () => {
    const url = await start();
    expect((await post(url, { ...body, points: [{ lat: 100, lng: 106.7 }, body.points[1]] })).status).toBe(400);
    expect((await post(url, { ...body, points: [...body.points, body.points[0]] })).status).toBe(400);
  });
  it('limits repeated searches and supplies Retry-After', async () => {
    const url = await start();
    for (let i = 0; i < 5; i++) expect((await post(url, body)).status).toBe(200);
    const response = await post(url, body); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60');
  });
});
