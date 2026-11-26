import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../../../testing/fixtures';
import { SignedUrlCache } from './SignedUrlCache';

describe('SignedUrlCache (review #18)', () => {
  it.each(['empty', 'error'] as const)(
    'an expired request ending with %s cannot evict its replacement',
    async (outcome) => {
      let now = 0;
      const old = deferred<string | null>();
      const current = deferred<string | null>();
      const sign = vi.fn().mockReturnValueOnce(old.promise).mockReturnValue(current.promise);
      const cache = new SignedUrlCache(sign, 1_000, () => now);
      const first = cache.get('a.png').catch(() => null);
      now = 1_001;
      const replacement = cache.get('a.png');
      if (outcome === 'empty') old.resolve(null);
      else old.reject(new Error('old request failed'));
      await first;
      current.resolve('new-signed-url');
      expect(await replacement).toBe('new-signed-url');
      expect(await cache.get('a.png')).toBe('new-signed-url');
      expect(sign).toHaveBeenCalledTimes(2);
    },
  );
  it('ảnh đã ký thì không ký lại khi danh sách báo cáo cập nhật', async () => {
    const sign = vi.fn(async (path: string) => `https://signed/${path}`);
    const cache = new SignedUrlCache(sign, 60_000);
    await cache.get('a.png');
    await cache.get('a.png');
    await cache.get('b.png');
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it('gần hết hạn thì ký lại', async () => {
    let now = 0;
    const sign = vi.fn(async () => 'https://signed/x');
    const cache = new SignedUrlCache(sign, 1_000, () => now);
    await cache.get('a.png');
    now = 1_001;
    await cache.get('a.png');
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it('ký lỗi hoặc không ra link thì không nhớ, lần sau thử lại', async () => {
    const sign = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('mạng'))
      .mockResolvedValue('ok');
    const cache = new SignedUrlCache(sign, 60_000);
    expect(await cache.get('a.png')).toBeNull();
    await expect(cache.get('a.png')).rejects.toThrow('mạng');
    expect(await cache.get('a.png')).toBe('ok');
    expect(sign).toHaveBeenCalledTimes(3);
  });

  it('refreshAt trả mốc hết hạn sớm nhất của các ảnh đang nhớ (issue #19, mục 18)', async () => {
    let now = 0;
    const cache = new SignedUrlCache(
      async (path) => `https://signed/${path}`,
      1_000,
      () => now,
    );
    await cache.get('a.png');
    now = 400;
    await cache.get('b.png');
    expect(cache.refreshAt(['a.png', 'b.png', 'unknown.png'])).toBe(1_000);
    expect(cache.refreshAt(['b.png'])).toBe(1_400);
    expect(cache.refreshAt(['unknown.png'])).toBeNull();
  });
});
