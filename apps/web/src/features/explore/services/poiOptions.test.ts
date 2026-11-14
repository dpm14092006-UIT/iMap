import { describe, expect, it } from 'vitest';
import type { Poi } from '../types';
import { ALONG_ROUTE_RADIUS_M, formatRadius, poiRadiusOptions, radiusForZoom, sortPois } from './poiOptions';

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

const zoomScenarios = Array.from({ length: 100 }, (_, index) => {
  const offset = ((index % 50) - 25) * 0.02;
  const zoom = index < 50 ? 13 + offset : 15 + offset;
  return { zoom, expected: zoom >= 15 ? 1000 : zoom >= 13 ? 3000 : 5000 };
});

describe('radius and zoom regression matrix', () => {
  it('keeps every automatic search radius selectable in the filter', () => {
    expect(poiRadiusOptions).toContain(ALONG_ROUTE_RADIUS_M);
    for (const zoom of [12, 14, 15]) expect(poiRadiusOptions).toContain(radiusForZoom(zoom));
  });

  it.each(zoomScenarios)('selects a nearby radius at zoom $zoom', ({ zoom, expected }) => {
    expect(radiusForZoom(zoom)).toBe(expected);
  });

  const radiusScenarios = Array.from({ length: 100 }, (_, index) => ({
    radius: index < 50 ? 950 + index : 1000 + (index - 50) * 137.25,
  }));

  it.each(radiusScenarios)('formats radius input $radius m in both locales', ({ radius }) => {
    const expected = (locale: 'vi-VN' | 'en-US') =>
      radius < 1000
        ? `${radius} m`
        : `${(radius / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km`;

    expect(formatRadius(radius, 'vi')).toBe(expected('vi-VN'));
    expect(formatRadius(radius, 'en')).toBe(expected('en-US'));
  });
});
