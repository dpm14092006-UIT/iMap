import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS_METERS, haversineMeters } from '../src/geo/haversine.js';
import { foldVietnamese, stripDiacritics } from '../src/text/vietnamese.js';

describe('shared great-circle distance', () => {
  it('is exactly zero for the same point', () =>
    expect(haversineMeters({ lat: 10, lng: 106 }, { lat: 10, lng: 106 })).toBe(0));
  it('matches a quarter of the equator', () =>
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 90 })).toBeCloseTo(
      (Math.PI * EARTH_RADIUS_METERS) / 2,
      6,
    ));
  it('remains finite at antipodes', () =>
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(
      Math.PI * EARTH_RADIUS_METERS,
      5,
    ));
  it('uses the short arc across the dateline', () =>
    expect(haversineMeters({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 })).toBeCloseTo(22239, 0));
  it('supports the historical web radius explicitly', () =>
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 90 }, 6371000)).toBeCloseTo(
      (Math.PI * 6371000) / 2,
      6,
    ));
  it.each([
    [10, 106, -20, 20],
    [89, 10, 89, 170],
    [-75, -160, 60, 160],
  ])('is symmetric for %j', (a, b, c, d) => {
    expect(haversineMeters({ lat: a, lng: b }, { lat: c, lng: d })).toBe(
      haversineMeters({ lat: c, lng: d }, { lat: a, lng: b }),
    );
  });
});
describe('Vietnamese normalization shared by web and API', () => {
  it.each([
    ['Đường Nguyễn Huệ', 'Duong Nguyen Hue'],
    ['Ắ ấ Ễ ộ Ử ỳ', 'A a E o U y'],
    ['ĐĐđđ', 'DDdd'],
    ['', ''],
    ['Café #1 - ATM', 'Cafe #1 - ATM'],
  ])('strips accents and preserves case: %s', (input, expected) =>
    expect(stripDiacritics(input)).toBe(expected),
  );
  it.each(['Đường Nguyễn Huệ', 'Bến Thành', 'CẦU GIẤY'])(
    'treats composed and decomposed Unicode identically: %s',
    (value) => {
      expect(foldVietnamese(value.normalize('NFD'))).toBe(foldVietnamese(value.normalize('NFC')));
    },
  );
  it('folds case and surrounding whitespace without destroying word boundaries', () =>
    expect(foldVietnamese(' \tĐƯỜNG  Điện Biên\n')).toBe('duong  dien bien'));
});
