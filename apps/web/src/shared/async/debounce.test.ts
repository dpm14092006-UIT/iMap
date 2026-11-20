import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

afterEach(() => vi.useRealTimers());

describe('debounce (review #17)', () => {
  it('nhiều sự kiện dồn dập chỉ tải lại một lần, sau khi im lặng', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const schedule = debounce(refresh, 500);
    for (let index = 0; index < 10; index++) {
      schedule();
      vi.advanceTimersByTime(100);
    }
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('cancel() bỏ lần chạy đang chờ', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const schedule = debounce(refresh, 500);
    schedule();
    schedule.cancel();
    vi.advanceTimersByTime(1000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
