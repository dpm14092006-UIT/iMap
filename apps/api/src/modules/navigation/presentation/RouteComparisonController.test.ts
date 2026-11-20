import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { RouteComparisonSnapshot, RoutePathResult } from '@routetwin/shared';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../../../createApp.js';
import { createContainer } from '../../../compositionRoot.js';
import { SupabaseClientFactory } from '../../../shared/supabase/SupabaseClientFactory.js';
import { CalculateRouteUseCase } from '../application/use-cases/CalculateRouteUseCase.js';
import { CompareRoutesUseCase } from '../application/use-cases/CompareRoutesUseCase.js';
import { SupabaseUserFeatureQuota } from '../../../shared/supabase/SupabaseUserFeatureQuota.js';
import { GenerativeRoutePreferenceProvider } from '../infrastructure/comparison/GenerativeRoutePreferenceProvider.js';
import { SignedRouteComparison } from '../infrastructure/comparison/SignedRouteComparison.js';
import { RouteComparisonController } from './RouteComparisonController.js';
import { RouteController } from './RouteController.js';

let server: Server | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

const fast: RoutePathResult = {
  source: 'vietmap',
  distanceMeters: 8_200,
  durationSeconds: 1_440,
  turnCount: 12,
  coordinates: [
    [106, 10],
    [106, 10.1],
    [106.1, 10.1],
  ],
  instructions: [],
};
const fewerTurns: RoutePathResult = {
  ...fast,
  distanceMeters: 9_100,
  durationSeconds: 1_620,
  turnCount: 6,
  coordinates: [
    [106, 10],
    [106.1, 10],
    [106.1, 10.1],
  ],
};

it('uses verified VietMap facts and sends only the preference to AI after auth and quota', async () => {
  const modelResponse = { goal: 'fewest-turns', maxExtraMinutes: 5 };
  const calls: { messages: { role: string; content: string }[] }[] = [];
  const originalFetch = globalThis.fetch;
  const upstream = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url) === 'http://model.test/api/chat') {
      calls.push(JSON.parse(String(options?.body)));
      return Response.json({ message: { content: JSON.stringify(modelResponse) } });
    }
    return originalFetch(url, options);
  });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'member' } }, error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  vi.spyOn(SupabaseClientFactory.prototype, 'create').mockReturnValue({
    auth: { getUser },
    rpc,
  } as unknown as ReturnType<SupabaseClientFactory['create']>);

  const container = createContainer();
  const model = new GenerativeRoutePreferenceProvider({
    provider: 'ollama',
    baseUrl: 'http://model.test',
    model: 'demo',
  });
  const compareRoutes = new CompareRoutesUseCase(
    new SignedRouteComparison('test-key'),
    model,
    new SupabaseUserFeatureQuota(),
  );
  container.routeComparisonController = new RouteComparisonController(compareRoutes);
  const calculate = new CalculateRouteUseCase({
    calculate: async () => ({ ...fast, alternatives: [fewerTurns] }),
  });
  container.routeController = new RouteController(calculate, compareRoutes);
  server = createApp(container).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a local port');
  const base = `http://127.0.0.1:${address.port}/api/routes`;
  const sessionId = randomUUID();
  const post = (path: string, body: unknown, authenticated = false) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated && { Authorization: 'Bearer test-session' }),
      },
      body: JSON.stringify(body),
    });

  const calculated = await post('/calculate', {
    points: [
      { lat: 10, lng: 106 },
      { lat: 10.1, lng: 106.1 },
    ],
    vehicle: 'motorcycle',
    alternatives: true,
    comparisonSessionId: sessionId,
  });
  expect(calculated.status).toBe(200);
  const {
    data: { comparison: snapshot },
  } = (await calculated.json()) as { data: { comparison: RouteComparisonSnapshot } };
  expect(snapshot.routes).toMatchObject([
    { id: 'A', turnCount: 12 },
    { id: 'B', turnCount: 6 },
  ]);
  const text = 'Ít rẽ hơn, đi thêm tối đa 5 phút';
  const request = { sessionId, snapshot: snapshot.token, preference: { kind: 'text', text } };

  expect((await post('/compare', { ...request, sessionId: randomUUID() }, true)).status).toBe(410);
  expect((await post('/compare', { ...request, snapshot: 'x' + snapshot.token }, true)).status).toBe(410);
  expect(await (await post('/compare', request)).json()).toMatchObject({
    data: { recommendedId: 'B', source: 'rules' },
  });
  expect(getUser).not.toHaveBeenCalled();
  expect(calls).toHaveLength(0);

  const result = await (
    await post('/compare', { ...request, routes: [{ id: 'A', durationSeconds: 1 }] }, true)
  ).json();
  expect(result).toMatchObject({
    data: {
      source: 'ai',
      recommendedId: 'B',
      baselineId: 'A',
      evidence: [
        { id: 'duration', delta: 180 },
        { id: 'distance', delta: 900 },
        { id: 'turns', delta: -6 },
      ],
    },
  });
  expect(rpc).toHaveBeenCalledExactlyOnceWith('consume_user_feature_quota', {
    p_feature: 'route_explanation',
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.messages.at(-1)?.content).toBe(JSON.stringify({ request: text }));

  await post('/compare', request, true);
  expect(calls).toHaveLength(1);

  const restricted = { ...request, preference: { kind: 'text', text: 'Ít rẽ hơn, đi thêm tối đa 2 phút' } };
  upstream.mockImplementation(async (url, options) => {
    if (String(url) === 'http://model.test/api/chat') return new Response(null, { status: 429 });
    return originalFetch(url, options);
  });
  expect(await (await post('/compare', restricted, true)).json()).toMatchObject({
    data: { source: 'rules', status: 'no-match', recommendedId: null },
  });
});
