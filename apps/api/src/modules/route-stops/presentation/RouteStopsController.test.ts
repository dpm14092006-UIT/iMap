import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { FindRouteStopsUseCase } from '../application/use-cases/FindRouteStopsUseCase.js';
import { RouteStopsController } from './RouteStopsController.js';

const body = {
  points: [
    { lat: 10.7, lng: 106.7 },
    { lat: 10.7, lng: 106.8 },
  ],
  vehicle: 'motorcycle',
  query: 'Tìm trạm xăng',
};

function request(): Request {
  return {
    path: '/search',
    body,
    auth: { userId: 'u', accessToken: 'token' },
    headers: {},
  } as unknown as Request;
}
function response() {
  const res = { statusCode: 200, headers: {} as Record<string, string>, payload: undefined as unknown };
  return Object.assign(res, {
    setHeader: (name: string, value: string) => void (res.headers[name.toLowerCase()] = value),
    status: (code: number) => ((res.statusCode = code), res),
    json: (payload: unknown) => void (res.payload = payload),
  }) as unknown as typeof res & Response;
}

describe('RouteStopsController', () => {
  it('không trừ hạn mức khi instance đang đầy (429 STOP_SEARCH_BUSY)', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    const findStops = { execute: vi.fn(async () => (await pending, { candidates: [] })) };
    const quota = { consume: vi.fn(async () => undefined) };
    const controller = new RouteStopsController(
      findStops as unknown as FindRouteStopsUseCase,
      undefined,
      false,
      quota,
    );
    const next = vi.fn();

    const running = [response(), response()].map((res) => controller.search(request(), res, next));
    const busy = response();
    await controller.search(request(), busy, next);

    expect(busy.statusCode).toBe(429);
    expect(busy.headers['retry-after']).toBe('60');
    expect(quota.consume).toHaveBeenCalledTimes(2); // chỉ hai yêu cầu đã có chỗ
    release();
    await Promise.all(running);
    expect(findStops.execute).toHaveBeenCalledTimes(2);
  });

  it('hết hạn mức thì trả Retry-After và không gọi provider', async () => {
    const findStops = { execute: vi.fn() };
    const { AppError } = await import('../../../shared/errors/AppError.js');
    const quota = {
      consume: vi.fn(async () => Promise.reject(new AppError(429, 'FEATURE_RATE_LIMIT', 'hết lượt'))),
    };
    const controller = new RouteStopsController(
      findStops as unknown as FindRouteStopsUseCase,
      undefined,
      false,
      quota,
    );
    const res = response();
    const next = vi.fn();
    await controller.search(request(), res, next);
    expect(res.headers['retry-after']).toBe('60');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }));
    expect(findStops.execute).not.toHaveBeenCalled();
  });
});
