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

const distanceScenarios = Array.from({ length: 100 }, (_, index) => ({
  meters: index < 50 ? 950 + index : 1000 + (index - 50) * 137.25,
}));

describe('distance formatting regression matrix', () => {
  it.each(distanceScenarios)('formats distance input $meters m in both locales', ({ meters }) => {
    const expected = (locale: 'vi-VN' | 'en-US') =>
      meters < 1000
        ? `${Math.round(meters)} m`
        : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;

    expect(formatDistanceMeters(meters, 'vi')).toBe(expected('vi-VN'));
    expect(formatDistanceMeters(meters, 'en')).toBe(expected('en-US'));
  });
});
