import { describe, expect, it, vi } from 'vitest';
import { runSignOutTasks } from './signOutTasks';

describe('runSignOutTasks', () => {
  it('isolates synchronous throws and still runs the remaining cleanup tasks', async () => {
    const remaining = vi.fn(async () => undefined);
    await expect(
      runSignOutTasks([
        () => {
          throw new Error('browser API blocked');
        },
        remaining,
      ]),
    ).resolves.toBeUndefined();
    expect(remaining).toHaveBeenCalledOnce();
  });
  it('chạy mọi việc, một việc lỗi không làm hỏng việc khác', async () => {
    const done = vi.fn();
    await runSignOutTasks([() => Promise.reject(new Error('mạng lỗi')), async () => done()]);
    expect(done).toHaveBeenCalledOnce();
  });

  it('việc treo không chặn đăng xuất quá thời gian chờ', async () => {
    vi.useFakeTimers();
    try {
      let finished = false;
      const run = runSignOutTasks([() => new Promise<void>(() => undefined)], 3_000).then(() => {
        finished = true;
      });
      await vi.advanceTimersByTimeAsync(2_999);
      expect(finished).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await run;
      expect(finished).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
