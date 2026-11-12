import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { PoiResult } from '@routetwin/shared';
import { ConcurrencyLimiter } from '../../../shared/http/ConcurrencyLimiter.js';
import { errorHandler } from '../../../shared/http/error-handler.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { SearchPoisAlongRouteUseCase } from '../application/use-cases/SearchPoisAlongRouteUseCase.js';
import type { SearchPoisNearbyUseCase } from '../application/use-cases/SearchPoisNearbyUseCase.js';
import { PoiSearchController } from './PoiSearchController.js';
import { createPlacesRouter } from './places.routes.js';
import { PlaceSearchController } from './PlaceSearchController.js';
import type { ReverseGeocodeUseCase } from '../application/use-cases/ReverseGeocodeUseCase.js';
import type { SearchPlacesUseCase } from '../application/use-cases/SearchPlacesUseCase.js';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

const poi: PoiResult = {
  id: 'ref',
  name: 'Phở Hòa',
  address: 'Quận 1',
  lat: 10.77,
  lng: 106.7,
  category: null,
  categoryCodes: [],
  distanceFromRouteM: 120,
  positionAlongRouteM: 3000,
  detourMin: 1,
};

async function start(options: {
  along?: (input: unknown) => Promise<PoiResult[]>;
  nearby?: (input: unknown) => Promise<PoiResult[]>;
  limiter?: ConcurrencyLimiter;
}) {
  const along = { execute: vi.fn(options.along ?? (async () => [poi])) };
  const nearby = { execute: vi.fn(options.nearby ?? (async () => [poi])) };
  const controller = new PoiSearchController(
    along as unknown as SearchPoisAlongRouteUseCase,
    nearby as unknown as SearchPoisNearbyUseCase,
    options.limiter,
  );
  const app = express();
  app.use(express.json());
  app.use(
    '/api/places',
    createPlacesRouter(
      new PlaceSearchController({} as SearchPlacesUseCase, {} as ReverseGeocodeUseCase),
      controller,
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, 'listening');
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/places`;
  return { along, nearby, base };
}
const post = (base: string, body: unknown) =>
  fetch(`${base}/along-route`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const path = [
  [10.77, 106.7],
  [10.8, 106.75],
];

describe('POST /api/places/along-route', () => {
  it('trả { data } và áp giá trị mặc định cho bán kính và limit', async () => {
    const { base, along } = await start({});
    const response = await post(base, { path, query: 'phở' });
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({ data: [poi] });
    expect(along.execute).toHaveBeenCalledWith({ path, query: 'phở', radiusM: 1500, limit: 20 });
  });

  it.each([
    ['thiếu từ khóa và danh mục', { path }],
    ['tuyến chỉ có 1 điểm', { path: [[10.77, 106.7]], query: 'phở' }],
    ['tuyến quá 500 điểm', { path: Array.from({ length: 501 }, () => [10.77, 106.7]), query: 'phở' }],
    ['bán kính nhỏ hơn 250 m', { path, query: 'phở', radiusM: 100 }],
    ['bán kính lớn hơn 5000 m', { path, query: 'phở', radiusM: 6000 }],
    ['limit lớn hơn 30', { path, query: 'phở', limit: 31 }],
    ['danh mục không tồn tại', { path, category: 'spa' }],
    [
      'vĩ độ ngoài phạm vi',
      {
        path: [
          [95, 106],
          [10, 106],
        ],
        query: 'phở',
      },
    ],
  ])('từ chối %s bằng 400 VALIDATION_ERROR', async (_name, body) => {
    const { base, along } = await start({});
    const response = await post(base, body);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
    expect(along.execute).not.toHaveBeenCalled();
  });

  it('chuyển lỗi nhà cung cấp thành mã lỗi của AppError', async () => {
    const { base } = await start({
      along: async () => {
        throw new AppError(429, 'PLACE_SEARCH_QUOTA', 'hết hạn mức');
      },
    });
    const response = await post(base, { path, category: 'fuel' });
    expect(response.status).toBe(429);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('PLACE_SEARCH_QUOTA');
  });

  it('trả 429 POI_SEARCH_BUSY khi vượt số lượt chạy đồng thời', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { base } = await start({ along: () => gate.then(() => [poi]), limiter: new ConcurrencyLimiter(1) });
    const first = post(base, { path, query: 'phở' });
    await vi.waitFor(async () => {
      const second = await post(base, { path, query: 'phở' });
      expect(second.status).toBe(429);
      expect(((await second.json()) as { error: { code: string } }).error.code).toBe('POI_SEARCH_BUSY');
    });
    release();
    expect((await first).status).toBe(200);
  });
});

describe('GET /api/places/nearby', () => {
  it('ép kiểu query string và gọi use case', async () => {
    const { base, nearby } = await start({});
    const response = await fetch(`${base}/nearby?lat=10.8&lng=106.75&query=${encodeURIComponent('sửa xe')}`);
    expect(response.status).toBe(200);
    expect(nearby.execute).toHaveBeenCalledWith({
      lat: 10.8,
      lng: 106.75,
      query: 'sửa xe',
      radiusM: 1500,
      limit: 20,
    });
  });

  it('cần query hoặc category, toạ độ hợp lệ', async () => {
    const { base } = await start({});
    expect((await fetch(`${base}/nearby?lat=10.8&lng=106.75`)).status).toBe(400);
    expect((await fetch(`${base}/nearby?lat=abc&lng=106.75&category=fuel`)).status).toBe(400);
    expect((await fetch(`${base}/nearby?lat=10.8&lng=106.75&category=fuel&radiusM=10`)).status).toBe(400);
    expect((await fetch(`${base}/nearby?lat=10.8&lng=106.75&category=fuel&radiusM=2000`)).status).toBe(200);
  });
});
