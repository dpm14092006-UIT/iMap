import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVnsdiBasemapRouter } from './vnsdiBasemapRouter.js';

const TOKEN = 'server-only-vnsdi-token';
let server: Server;

async function start(request: typeof fetch, token: string | undefined = TOKEN) {
  const app = express();
  app.use('/map', createVnsdiBasemapRouter(token, request));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/map`;
}

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('VNSDI basemap proxy', () => {
  it('adds the token on the server and returns PNG tiles', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(bytes, { headers: { 'content-type': 'image/png' } }));
    const base = await start(request);
    const response = await fetch(`${base}/admin/tile/6/28/51?token=untrusted`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).toBe(
      `https://vnsdi.mae.gov.vn/basemap/rest/services/BanDoHanhChinhVietNam/MapServer/tile/6/28/51?token=${TOKEN}`,
    );
    expect(options?.redirect).toBe('error');
  });

  it('turns ArcGIS JSON token errors into 401 without leaking details', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ error: { code: 499, message: TOKEN } }));
    const base = await start(request);
    const response = await fetch(`${base}/terrain/tile/6/28/51`);
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(TOKEN);
  });

  it('answers 503 when no token is configured', async () => {
    const request = vi.fn<typeof fetch>();
    expect((await fetch(`${await start(request, '')}/admin/tile/6/28/51`)).status).toBe(503);
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects unknown services or coordinates', async () => {
    const request = vi.fn<typeof fetch>();
    const base = await start(request);
    for (const path of [
      '/Sentinel2/tile/6/28/51',
      '/admin/tile/19/0/0',
      '/admin/tile/3/8/0',
      '/admin/MapServer',
    ]) {
      expect((await fetch(base + path)).status).toBe(404);
    }
    expect(request).not.toHaveBeenCalled();
  });
});
