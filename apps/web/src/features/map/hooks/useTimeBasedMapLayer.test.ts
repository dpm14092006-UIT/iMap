import { describe, expect, it } from 'vitest';
import { nextMapThemeChange, scheduledMapLayer } from './useTimeBasedMapLayer';

const at = (hour: number, minute: number) => new Date(2026, 0, 10, hour, minute);

describe('scheduledMapLayer', () => {
  it('đổi giao diện đúng tại các mốc 18:00 và 06:00', () => {
    expect(scheduledMapLayer(at(17, 59))).toBe('street');
    expect(scheduledMapLayer(at(18, 0))).toBe('dark');
    expect(scheduledMapLayer(at(5, 59))).toBe('dark');
    expect(scheduledMapLayer(at(6, 0))).toBe('street');
  });

  it('hẹn đúng lần đổi tiếp theo', () => {
    expect(nextMapThemeChange(at(10, 0)).getHours()).toBe(18);
    const evening = nextMapThemeChange(at(20, 0));
    expect([evening.getDate(), evening.getHours()]).toEqual([11, 6]);
    expect(nextMapThemeChange(at(3, 0)).getHours()).toBe(6);
  });
});
