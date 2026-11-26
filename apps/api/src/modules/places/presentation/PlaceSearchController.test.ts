import { afterEach, describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { errorHandler } from '../../../shared/http/errorHandler.js';
import type { PlaceSearchProvider } from '../application/ports/PlaceSearchProvider.js';
import type { ReverseGeocodeUseCase } from '../application/use-cases/ReverseGeocodeUseCase.js';
import type { SearchPlacesUseCase } from '../application/use-cases/SearchPlacesUseCase.js';
import type { PoiSearchController } from './PoiSearchController.js';
import { PlaceSearchController } from './PlaceSearchController.js';
import { createPlacesRouter } from './placesRouter.js';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

const endRequest: RequestHandler = (_req, res) => {
  res.end();
};

async function start() {
  const search = { execute: vi.fn(async () => []) };
  const reverse = { execute: vi.fn(async () => null) };
  const resolve = vi.fn(async (id: string) => ({ id, name: 'A', address: '', lat: 10.77, lng: 106.69 }));
  const app = express();
  app.use(
    '/api/places',
    createPlacesRouter(
      new PlaceSearchController(
        search as unknown as SearchPlacesUseCase,
        reverse as unknown as ReverseGeocodeUseCase,
        { resolve } as unknown as PlaceSearchProvider,
      ),
      { searchAlongRoute: endRequest, searchNearby: endRequest } as unknown as PoiSearchController,
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, 'listening');
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/places`;
  const get = async (path: string) => {
    const response = await fetch(`${base}${path}`);
    return { status: response.status, body: (await response.json()) as { error?: { message: string } } };
  };
  return { get, search, reverse, resolve };
}

describe('GET /api/places/suggest', () => {
  it('gửi vị trí ưu tiên khi tọa độ hợp lệ trong vùng', async () => {
    const { get, search } = await start();
    expect((await get('/suggest?q=ch%E1%BB%A3&lat=10.77&lng=106.69')).status).toBe(200);
    expect(search.execute).toHaveBeenCalledWith('chợ', { lat: 10.77, lng: 106.69 }, 'all');
  });

  it('bỏ qua vị trí ưu tiên ngoài vùng VietMap thay vì báo lỗi', async () => {
    const { get, search } = await start();
    expect((await get('/suggest?q=pho&lat=48.85&lng=2.35')).status).toBe(200);
    expect(search.execute).toHaveBeenCalledWith('pho', undefined, 'all');
  });

  it.each([
    ['vĩ độ rỗng (trước đây thành 0)', '/suggest?q=pho&lat=&lng='],
    ['tọa độ hex', '/suggest?q=pho&lat=0x0A&lng=0x6A'],
    ['chỉ có vĩ độ', '/suggest?q=pho&lat=10.77'],
    ['từ khóa chỉ có ký tự điều khiển', '/suggest?q=%00%01%02'],
    ['từ khóa chỉ có emoji', '/suggest?q=%F0%9F%98%80%F0%9F%98%80'],
  ])('từ chối %s bằng 400, không gọi VietMap', async (_name, path) => {
    const { get, search } = await start();
    const response = await get(path);
    expect(response.status).toBe(400);
    expect(response.body.error?.message).not.toBe('Dữ liệu không hợp lệ');
    expect(search.execute).not.toHaveBeenCalled();
  });
});

describe('GET /api/places/reverse', () => {
  it.each([
    ['rỗng', '/reverse?lat=&lng=', 'Giá trị phải là số thập phân hợp lệ.'],
    ['ngoài vùng', '/reverse?lat=0&lng=0', 'Vị trí nằm ngoài vùng bản đồ Việt Nam mà iMap hỗ trợ.'],
  ])('từ chối tọa độ %s với thông báo tiếng Việt', async (_name, path, message) => {
    const { get, reverse } = await start();
    const response = await get(path);
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toBe(message);
    expect(reverse.execute).not.toHaveBeenCalled();
  });
});

describe('GET /api/places/details', () => {
  it('nhận mã tham chiếu VietMap', async () => {
    const { get, resolve } = await start();
    expect((await get('/details?id=auto%3AabcDEF123')).status).toBe(200);
    expect(resolve).toHaveBeenCalledWith('auto:abcDEF123');
  });

  it.each([
    ['có khoảng trắng', '/details?id=a%20b'],
    ['có ký tự ngoài ASCII', '/details?id=ch%E1%BB%A3'],
    ['dài quá 512 ký tự', `/details?id=${'a'.repeat(513)}`],
  ])('từ chối mã %s', async (_name, path) => {
    const { get, resolve } = await start();
    const response = await get(path);
    expect(response.status).toBe(400);
    expect(resolve).not.toHaveBeenCalled();
  });
});
