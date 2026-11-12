import { describe, expect, it } from 'vitest';
import { minutesSlowerThanFastest, routeLabels } from './routeLabels';

const routes = [
  { durationMin: 85, distanceKm: 97.9, variant: 'default' as const },
  { durationMin: 108, distanceKm: 113.9, variant: 'avoid-toll' as const },
  { durationMin: 123, distanceKm: 90, variant: 'avoid-motorway' as const },
];

describe('routeLabels', () => {
  it('gắn Nhanh nhất, Ngắn nhất và lý do của biến thể', () => {
    expect(routeLabels(routes[0]!, routes)).toEqual(['Nhanh nhất']);
    expect(routeLabels(routes[1]!, routes)).toEqual(['Tránh trạm thu phí']);
    expect(routeLabels(routes[2]!, routes)).toEqual(['Ngắn nhất', 'Tránh cao tốc']);
  });

  it('tính số phút chậm hơn so với tuyến nhanh nhất', () => {
    expect(minutesSlowerThanFastest(routes[0]!, routes)).toBe(0);
    expect(minutesSlowerThanFastest(routes[1]!, routes)).toBe(23);
  });
});
