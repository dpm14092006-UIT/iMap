import { afterEach, describe, expect, it, vi } from 'vitest';
import { timeoutSignal } from './timeoutSignal';

afterEach(() => vi.useRealTimers());

describe('timeoutSignal (review #12)', () => {
  it('vẫn hủy khi quá giờ dù trình duyệt không có AbortSignal.any / AbortSignal.timeout', () => {
    vi.useFakeTimers();
    // Giả lập Safari iOS < 17.4 rồi khôi phục để không ảnh hưởng test khác.
    const signalStatics = AbortSignal as unknown as Record<'any' | 'timeout', unknown>;
    const original = { any: signalStatics.any, timeout: signalStatics.timeout };
    signalStatics.any = undefined;
    signalStatics.timeout = undefined;
    try {
      const caller = new AbortController();
      const timeout = timeoutSignal(45_000, caller.signal);
      vi.advanceTimersByTime(44_999);
      expect(timeout.signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(timeout.signal.aborted).toBe(true);
      expect(timeout.timedOut()).toBe(true);
    } finally {
      Object.assign(signalStatics, original);
    }
  });

  it('nơi gọi hủy thì tín hiệu gộp cũng hủy, và không bị tính là quá giờ', () => {
    const caller = new AbortController();
    const timeout = timeoutSignal(45_000, caller.signal);
    caller.abort();
    expect(timeout.signal.aborted).toBe(true);
    expect(timeout.timedOut()).toBe(false);
    timeout.dispose();
  });

  it('tín hiệu của nơi gọi đã hủy từ trước thì hủy ngay', () => {
    const caller = new AbortController();
    caller.abort();
    expect(timeoutSignal(45_000, caller.signal).signal.aborted).toBe(true);
  });

  it('dispose() bỏ hẹn giờ: xong request thì không hủy nữa', () => {
    vi.useFakeTimers();
    const timeout = timeoutSignal(1_000);
    timeout.dispose();
    vi.advanceTimersByTime(5_000);
    expect(timeout.signal.aborted).toBe(false);
  });
});
