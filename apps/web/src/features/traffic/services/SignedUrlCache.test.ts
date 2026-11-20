import { describe, expect, it, vi } from 'vitest';
import { SignedUrlCache } from './SignedUrlCache';

describe('SignedUrlCache (review #18)', () => {
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
});
