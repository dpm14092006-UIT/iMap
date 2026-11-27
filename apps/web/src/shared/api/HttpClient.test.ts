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

  it('quá giờ báo lỗi TIMEOUT kể cả khi trình duyệt chỉ ném AbortError chung chung', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
            }),
        ),
      );
      const request = new HttpClient({ baseUrl: '', timeoutMs: 1000 }).get('/slow');
      const assertion = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('hẹn giờ vẫn chạy khi server gửi header rồi treo lúc gửi nội dung', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) =>
          Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers(),
            // Nội dung không bao giờ tới, chỉ dừng khi tín hiệu hủy bật.
            json: () =>
              new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () =>
                  reject(new DOMException('aborted', 'AbortError')),
                );
              }),
          } as unknown as Response),
        ),
      );
      const request = new HttpClient({ baseUrl: '', timeoutMs: 1000 }).get('/stalled-body');
      const assertion = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  describe('nguồn token', () => {
    const invalid = () =>
      Response.json({ error: { code: 'INVALID_SESSION', message: 'Phiên hết hạn' } }, { status: 401 });
    const auth = (fetcher: ReturnType<typeof vi.fn>, call: number) =>
      (fetcher.mock.calls[call]![1].headers as Headers).get('Authorization');

    it('dùng token còn hạn từ tầng auth thay cho token cũ', async () => {
      const http = new HttpClient({ baseUrl: '/api', timeoutMs: 1000 });
      http.setAccessTokenProvider({ current: async () => 'moi', refresh: async () => 'moi2' });
      const fetcher = vi.fn().mockResolvedValue(Response.json({ data: 1 }));
      vi.stubGlobal('fetch', fetcher);
      await http.post('/x', {}, { accessToken: 'cu' });
      expect(auth(fetcher, 0)).toBe('Bearer moi');
    });

    it('INVALID_SESSION: làm mới phiên rồi gửi lại đúng một lần', async () => {
      const http = new HttpClient({ baseUrl: '/api', timeoutMs: 1000 });
      const refresh = vi.fn().mockResolvedValue('moi');
      http.setAccessTokenProvider({ current: async () => 'cu', refresh });
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(invalid())
        .mockResolvedValue(Response.json({ data: 2 }));
      vi.stubGlobal('fetch', fetcher);
      expect(await http.post('/x', { a: 1 }, { accessToken: 'cu' })).toBe(2);
      expect(refresh).toHaveBeenCalledOnce();
      expect(auth(fetcher, 1)).toBe('Bearer moi');
      expect(fetcher.mock.calls[1]![1].body).toBe('{"a":1}');
    });

    it('không làm mới được thì báo lỗi phiên gốc', async () => {
      const http = new HttpClient({ baseUrl: '/api', timeoutMs: 1000 });
      http.setAccessTokenProvider({ current: async () => 'cu', refresh: async () => null });
      const fetcher = vi.fn().mockResolvedValue(invalid());
      vi.stubGlobal('fetch', fetcher);
      const error = (await http.get('/x', { accessToken: 'cu' }).catch((c: unknown) => c)) as ApiError;
      expect(error).toMatchObject({ status: 401, code: 'INVALID_SESSION' });
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('tầng auth lỗi thì vẫn gửi bằng token sẵn có', async () => {
      const http = new HttpClient({ baseUrl: '/api', timeoutMs: 1000 });
      http.setAccessTokenProvider({
        current: () => Promise.reject(new Error('offline')),
        refresh: async () => null,
      });
      const fetcher = vi.fn().mockResolvedValue(Response.json({ data: 3 }));
      vi.stubGlobal('fetch', fetcher);
      expect(await http.get('/x', { accessToken: 'cu' })).toBe(3);
      expect(auth(fetcher, 0)).toBe('Bearer cu');
    });

    it('yêu cầu không cần đăng nhập thì không gắn token', async () => {
      const http = new HttpClient({ baseUrl: '/api', timeoutMs: 1000 });
      http.setAccessTokenProvider({ current: async () => 'moi', refresh: async () => 'moi' });
      const fetcher = vi.fn().mockResolvedValue(Response.json({ data: 4 }));
      vi.stubGlobal('fetch', fetcher);
      await http.get('/x');
      expect(auth(fetcher, 0)).toBeNull();
    });
  });
});
