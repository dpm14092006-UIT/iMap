import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './ApiError';
import { HttpClient } from './HttpClient';

const client = new HttpClient({ baseUrl: '/api', timeoutMs: 1000 });
afterEach(() => vi.unstubAllGlobals());

describe('HttpClient', () => {
  it('bóc phong bì { data } và gắn token', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { ok: 1 } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await client.post('/x', { a: 1 }, { accessToken: 't' })).toEqual({ ok: 1 });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/x');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer t');
    expect(init.body).toBe('{"a":1}');
  });

  it('báo lỗi mạng bằng tiếng Việt thay vì "Failed to fetch"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await client.get('/x').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(/Không kết nối được máy chủ/);
    expect((error as ApiError).isServerError).toBe(false);
  });

  it('giữ thông báo lỗi do máy chủ trả về', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: { code: 'X', message: 'Sai rồi' } }, { status: 400 })),
    );
    const error = (await client.get('/x').catch((cause: unknown) => cause)) as ApiError;
    expect(error).toMatchObject({ status: 400, code: 'X', message: 'Sai rồi', isServerError: true });
  });

  it('yêu cầu do nơi gọi hủy giữ nguyên lỗi hủy', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    const error = await client.get('/x', { signal: controller.signal }).catch((cause: unknown) => cause);
    expect((error as Error).name).toBe('AbortError');
  });

  it('429: đọc Retry-After và báo thời gian chờ bằng tiếng Việt', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: 'RATE_LIMITED', message: 'Bạn gửi quá nhiều yêu cầu.' } },
            { status: 429, headers: { 'Retry-After': '12' } },
          ),
        ),
    );
    const error = (await client.get('/x').catch((cause: unknown) => cause)) as ApiError;
    expect(error).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 12,
      message: 'Bạn thao tác quá nhanh, thử lại sau 12 giây.',
    });
  });

  it('429 không có Retry-After giữ thông điệp của máy chủ', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { code: 'RATE_LIMITED', message: 'Chậm lại' } }, { status: 429 }),
        ),
    );
    const error = (await client.get('/x').catch((cause: unknown) => cause)) as ApiError;
    expect(error).toMatchObject({ status: 429, message: 'Chậm lại', retryAfterSeconds: undefined });
  });
});
