import { describe, expect, it } from 'vitest';
import { ConcurrencyLimiter } from './ConcurrencyLimiter.js';

describe('ConcurrencyLimiter', () => {
  it('từ chối khi đã đủ số yêu cầu song song và nhả chỗ khi xong', async () => {
    const limiter = new ConcurrencyLimiter(1);
    let release!: () => void;
    const first = limiter.run(() => new Promise<string>((resolve) => (release = () => resolve('a'))));
    expect(await limiter.run(async () => 'b')).toBeUndefined();
    release();
    expect(await first).toEqual({ value: 'a' });
    expect(await limiter.run(async () => 'c')).toEqual({ value: 'c' });
  });

  it('nhả chỗ cả khi tác vụ ném lỗi', async () => {
    const limiter = new ConcurrencyLimiter(1);
    await expect(
      limiter.run(async () => {
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
    expect(await limiter.run(async () => 'ok')).toEqual({ value: 'ok' });
  });
});
