import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenIdle } from './whenIdle';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('whenIdle (review #21)', () => {
  it('trình duyệt rảnh sớm thì chạy ngay, không chờ đủ thời hạn', () => {
    const requestIdleCallback = vi.fn((callback: () => void) => {
      callback(); // giả lập trình duyệt rảnh ngay
      return 1;
    });
    vi.stubGlobal('window', { requestIdleCallback, cancelIdleCallback: vi.fn() });
    const run = vi.fn();
    whenIdle(run, 1200);
    expect(run).toHaveBeenCalledOnce();
    expect(requestIdleCallback).toHaveBeenCalledWith(run, { timeout: 1200 });
  });

  it('không có requestIdleCallback thì chờ đúng thời hạn; hủy được', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const run = vi.fn();
    whenIdle(run, 1200);
    vi.advanceTimersByTime(1199);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledOnce();

    const cancelled = vi.fn();
    whenIdle(cancelled, 1200)();
    vi.advanceTimersByTime(2000);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
