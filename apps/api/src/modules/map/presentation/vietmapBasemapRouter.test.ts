import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVietmapBasemapRouter } from './vietmapBasemapRouter.js';

const KEY = 'server-only-tilemap-key';
const tile = '/tiles/vlc-20261123/5/25/15.pbf';
let server: Server;

async function start(request: typeof fetch, key: string | undefined = KEY) {
  const app = express();
  app.use('/map', createVietmapBasemapRouter(key, request));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/map`;
}

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('Vietmap basemap proxy', () => {
  it('keeps the key on the server and preserves tile template variables in style JSON', async () => {
    const template = 'https://maps.vietmap.vn/maps/tiles/vlc-20261123/{z}/{x}/{y}.pbf';
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: 8,
        sources: { roads: { type: 'vector', tiles: [`${template}?apikey=${KEY}`] } },
      }),
    );
    const base = await start(request);
    const response = await fetch(`${base}/styles/tm/style.json?apikey=untrusted`);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain(template);
    expect(body).not.toMatch(/apikey|server-only/);
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).toBe(`https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${KEY}`);
    expect(options?.redirect).toBe('error');
  });

  it('proxies tile bytes and relays access errors without leaking upstream response details', async () => {
    const bytes = new Uint8Array([5, 7, 9]);
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(bytes))
      .mockResolvedValueOnce(new Response(KEY, { status: 423 }));
    const base = await start(request);
    const success = await fetch(base + tile);
    expect(success.headers.get('content-type')).toContain('application/x-protobuf');
    expect(new Uint8Array(await success.arrayBuffer())).toEqual(bytes);
    const blocked = await fetch(base + tile);
    expect(blocked.status).toBe(423);
    expect(await blocked.text()).not.toContain(KEY);
  });

  it('rejects paths outside the basemap and invalid tile coordinates', async () => {
    const request = vi.fn<typeof fetch>();
    const base = await start(request);
    for (const path of ['/api/autocomplete/v4', '/tiles/st/5/32/15.png', '/styles/other/style.json']) {
      expect((await fetch(base + path)).status).toBe(404);
    }
    expect(request).not.toHaveBeenCalled();
  });
});
