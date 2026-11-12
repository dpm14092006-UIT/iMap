import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { ApiPoiProvider } from './apiPoiProvider';

function setup() {
  const http = { get: vi.fn().mockResolvedValue([]), post: vi.fn().mockResolvedValue([]) };
  return { http, provider: new ApiPoiProvider(http as unknown as HttpClient) };
}

describe('ApiPoiProvider', () => {
  it('nearby gửi tâm, bán kính và chỉ trường từ khóa/danh mục có giá trị', async () => {
    const { http, provider } = setup();
    const controller = new AbortController();
    await provider.nearby({ lat: 10.8, lng: 106.75 }, { query: 'sửa xe' }, 1000, controller.signal);
    const [endpoint, options] = http.get.mock.calls[0]!;
    const url = new URL(endpoint, 'http://x');
    expect(url.pathname).toBe('/places/nearby');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: '10.80000',
      lng: '106.75000',
      radiusM: '1000',
      query: 'sửa xe',
    });
    expect(options.signal).toBe(controller.signal);
  });

  it('alongRoute gửi tuyến đã rút gọn <= 500 điểm cùng danh mục', async () => {
    const { http, provider } = setup();
    const path = Array.from(
      { length: 2000 },
      (_, i) => [10.7 + i * 0.0001, 106.7 + Math.sin(i / 10) * 0.003] as [number, number],
    );
    await provider.alongRoute(path, { category: 'fuel' }, 1500);
    const [endpoint, body] = http.post.mock.calls[0]!;
    expect(endpoint).toBe('/places/along-route');
    expect(body.category).toBe('fuel');
    expect(body.query).toBeUndefined();
    expect(body.radiusM).toBe(1500);
    expect(body.path.length).toBeLessThanOrEqual(500);
  });
});
