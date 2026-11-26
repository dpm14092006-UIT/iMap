import { describe, expect, it } from 'vitest';
import { minutesSlowerThanFastest, routeLabels } from './routeLabels';

const routes = [
  { durationMin: 85, distanceKm: 97.9, variant: 'default' as const },
  { durationMin: 108, distanceKm: 113.9, variant: 'avoid-toll' as const },
  { durationMin: 123, distanceKm: 90, variant: 'alternative' as const },
  { durationMin: 130, distanceKm: 120, variant: 'alternative' as const },
  { durationMin: 140, distanceKm: 125, variant: 'avoid-ferry' as const },
];

describe('routeLabels', () => {
  it('gắn Nhanh nhất, Ngắn nhất và lý do của biến thể', () => {
    expect(routeLabels(routes[0]!, routes)).toEqual(['Nhanh nhất']);
    expect(routeLabels(routes[1]!, routes)).toEqual(['Tránh trạm thu phí']);
    // "Tuyến khác" không lặp khi đã có nhãn Ngắn nhất.
    expect(routeLabels(routes[2]!, routes)).toEqual(['Ngắn nhất']);
    expect(routeLabels(routes[3]!, routes)).toEqual(['Tuyến khác']);
    expect(routeLabels(routes[4]!, routes)).toEqual(['Tránh phà']);
  });

  it('không gắn "Ngắn nhất" cho tuyến chậm hơn khi nó dài bằng tuyến nhanh nhất', () => {
    const tie = [
      { durationMin: 1.77, distanceKm: 0.875, variant: 'default' as const },
      { durationMin: 1.92, distanceKm: 0.875, variant: 'alternative' as const },
    ];
    expect(routeLabels(tie[0]!, tie)).toEqual(['Nhanh nhất']);
    expect(routeLabels(tie[1]!, tie)).toEqual(['Tuyến khác']);
  });

  it('chênh lệch quá nhỏ (dưới 10 m hoặc 1%) không tính là ngắn hơn', () => {
    const almost = [
      { durationMin: 10, distanceKm: 5.0, variant: 'default' as const },
      { durationMin: 11, distanceKm: 4.97, variant: 'alternative' as const },
    ];
    expect(routeLabels(almost[1]!, almost)).toEqual(['Tuyến khác']);
    const clearly = [
      { durationMin: 10, distanceKm: 5.0, variant: 'default' as const },
      { durationMin: 11, distanceKm: 4.8, variant: 'alternative' as const },
    ];
    expect(routeLabels(clearly[1]!, clearly)).toEqual(['Ngắn nhất']);
  });

  it('tính số phút chậm hơn so với tuyến nhanh nhất', () => {
    expect(minutesSlowerThanFastest(routes[0]!, routes)).toBe(0);
    expect(minutesSlowerThanFastest(routes[1]!, routes)).toBe(23);
  });
});
