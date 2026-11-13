import { describe, expect, it } from 'vitest';
import type { Poi } from '../types';
import { formatRadius, radiusForZoom, sortPois } from './poiOptions';

const poi = (id: string, along: number, route: number, detour: number, center?: number): Poi => ({
  id,
  name: id,
  address: '',
  lat: 0,
  lng: 0,
  category: null,
  categoryCodes: [],
  positionAlongRouteM: along,
  distanceFromRouteM: route,
  detourMin: detour,
  ...(center === undefined ? {} : { distanceFromCenterM: center }),
});

describe('radiusForZoom', () => {
  it('≥15 là 1 km, 13–14 là 3 km, xa hơn là 5 km', () => {
    expect(radiusForZoom(17)).toBe(1000);
    expect(radiusForZoom(15)).toBe(1000);
    expect(radiusForZoom(14)).toBe(3000);
    expect(radiusForZoom(13)).toBe(3000);
    expect(radiusForZoom(12)).toBe(5000);
  });
});

describe('sortPois', () => {
  const list = [poi('a', 5000, 100, 2), poi('b', 1000, 900, 9), poi('c', 3000, 300, 1)];
  it('theo tuyến, gần nhất, ít đi vòng nhất', () => {
    expect(sortPois(list, 'route', 'alongRoute').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(sortPois(list, 'distance', 'alongRoute').map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(sortPois(list, 'detour', 'alongRoute').map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
  it('quanh đây luôn xếp theo khoảng cách tới tâm và không đổi mảng gốc', () => {
    const near = [poi('x', 0, 0, 0, 800), poi('y', 0, 0, 0, 100)];
    expect(sortPois(near, 'route', 'nearby').map((p) => p.id)).toEqual(['y', 'x']);
    expect(near.map((p) => p.id)).toEqual(['x', 'y']);
  });
});

describe('formatRadius', () => {
  it('mét dưới 1 km, km có dấu phẩy', () => {
    expect(formatRadius(500)).toBe('500 m');
    expect(formatRadius(1500)).toBe('1,5 km');
    expect(formatRadius(5000)).toBe('5 km');
  });

  it('uses the decimal separator for the selected language', () => {
    expect(formatRadius(1500, 'en')).toBe('1.5 km');
  });
});
