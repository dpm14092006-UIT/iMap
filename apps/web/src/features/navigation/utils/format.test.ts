import { describe, expect, it } from 'vitest';
import { formatDistanceMeters, formatDurationMinutes } from './format';

describe('localized route measurements', () => {
  it('uses the selected decimal separator for distances', () => {
    expect(formatDistanceMeters(1500, 'vi')).toBe('1,5 km');
    expect(formatDistanceMeters(1500, 'en')).toBe('1.5 km');
  });

  it('formats travel time in the selected language', () => {
    expect(formatDurationMinutes(75, 'vi')).toBe('1 giờ 15 phút');
    expect(formatDurationMinutes(75, 'en')).toBe('1 hr 15 min');
  });
});
