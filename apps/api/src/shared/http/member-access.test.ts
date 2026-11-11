import { afterEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { createContainer } from '../../composition-root.js';
import { SupabaseClientFactory } from '../supabase/SupabaseClientFactory.js';
let server: Server | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});
async function start() {
  const container = createContainer();
  const stops = vi.spyOn(container.findRouteStops, 'execute');
  const explore = vi.spyOn(container.explorePlaces, 'execute');
  server = createApp(container).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('port');
  return { base: `http://127.0.0.1:${address.port}`, stops, explore };
}
const protectedEndpoints = [
  ['POST', '/api/route-stops/search'],
  ['POST', '/api/route-stops/explore'],
  ['POST', '/api/voice/transcribe'],
  ['GET', '/api/voice/config'],
  ['POST', '/api/traffic-reports/analyze-image'],
] as const;
describe('member access on the actual application', () => {
  it('blocks every AI endpoint before invoking providers for an anonymous visitor', async () => {
    const auth = vi.spyOn(SupabaseClientFactory.prototype, 'create');
    const { base, stops, explore } = await start();
    for (const [method, path] of protectedEndpoints) {
      const response = await fetch(base + path, { method });
      expect(response.status, path).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
    }
    expect(auth).not.toHaveBeenCalled();
    expect(stops).not.toHaveBeenCalled();
    expect(explore).not.toHaveBeenCalled();
  });
  it('verifies Bearer sessions at Supabase and rejects forged/expired tokens', async () => {
    const getUser = vi.fn(async () => ({ data: { user: null }, error: { status: 401 } }));
    vi.spyOn(SupabaseClientFactory.prototype, 'create').mockReturnValue({
      auth: { getUser },
    } as unknown as ReturnType<SupabaseClientFactory['create']>);
    const { base, stops, explore } = await start();
    for (const [method, path] of protectedEndpoints) {
      const response = await fetch(base + path, {
        method,
        headers: { Authorization: 'Bearer forged-session', 'X-User-Id': 'invented-member' },
      });
      expect(response.status, path).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_SESSION' } });
    }
    expect(getUser).toHaveBeenCalledTimes(protectedEndpoints.length);
    expect(getUser).toHaveBeenCalledWith('forged-session');
    expect(stops).not.toHaveBeenCalled();
    expect(explore).not.toHaveBeenCalled();
  });
  it('does not grant member features to Supabase anonymous accounts', async () => {
    vi.spyOn(SupabaseClientFactory.prototype, 'create').mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'anonymous-user', is_anonymous: true } }, error: null }),
      },
    } as unknown as ReturnType<SupabaseClientFactory['create']>);
    const { base, explore } = await start();
    const response = await fetch(base + '/api/route-stops/explore', {
      method: 'POST',
      headers: { Authorization: 'Bearer anonymous-session' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'ACCOUNT_REQUIRED' } });
    expect(explore).not.toHaveBeenCalled();
  });
  it('fails closed when the auth service is unavailable', async () => {
    vi.spyOn(SupabaseClientFactory.prototype, 'create').mockImplementation(() => {
      throw Error('offline');
    });
    const { base, explore } = await start();
    const response = await fetch(base + '/api/route-stops/explore', {
      method: 'POST',
      headers: { Authorization: 'Bearer session' },
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'AUTH_UNAVAILABLE' } });
    expect(explore).not.toHaveBeenCalled();
  });
  it('keeps health, place search and routing available without a session', async () => {
    const { base } = await start();
    expect((await fetch(base + '/api/health')).status).toBe(200);
    // Invalid input stops before upstream I/O, while proving these routes do not require auth.
    const place = await fetch(base + '/api/places/suggest?q=a');
    expect(place.status).toBe(400);
    const route = await fetch(base + '/api/routes/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(route.status).toBe(400);
  });
});
