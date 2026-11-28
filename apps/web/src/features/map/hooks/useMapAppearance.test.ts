import { describe, expect, it } from 'vitest';
import { isNightTime, resolveMapLayer } from './useMapAppearance';

describe('resolveMapLayer', () => {
  it('ban ngày (6:00–17:59) sáng, từ 18:00 tới trước 6:00 tối', () => {
    const at = (hour: number, minute = 0) => new Date(2026, 10, 28, hour, minute);
    expect(isNightTime(at(6))).toBe(false);
    expect(isNightTime(at(9))).toBe(false);
    expect(isNightTime(at(17, 59))).toBe(false);
    expect(isNightTime(at(18))).toBe(true);
    expect(isNightTime(at(23))).toBe(true);
    expect(isNightTime(at(5, 59))).toBe(true);
  });

  it('follows the time of day in automatic mode', () => {
    expect(resolveMapLayer('auto', false)).toBe('street');
    expect(resolveMapLayer('auto', true)).toBe('dark');
  });

  it('keeps each explicit map choice independent of the interface theme', () => {
    expect(resolveMapLayer('street', true)).toBe('street');
    expect(resolveMapLayer('dark', false)).toBe('dark');
    expect(resolveMapLayer('satellite', true)).toBe('satellite');
  });
});
