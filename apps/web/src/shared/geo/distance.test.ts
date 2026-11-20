import { describe, expect, it } from 'vitest';
import {
  approxDistanceMeters,
  bearingDegrees,
  haversineMeters,
  metersPerDegreeLng,
  offsetByMeters,
} from './distance';

const saigon = { lat: 10.7769, lng: 106.7009 };

describe('distance primitives', () => {
  it('haversine khớp khoảng cách đã biết và bằng 0 khi trùng điểm', () => {
    expect(haversineMeters(saigon, saigon)).toBe(0);
    // 0.01° vĩ độ ≈ 1.112 m ở mọi nơi.
    expect(haversineMeters(saigon, { lat: saigon.lat + 0.01, lng: saigon.lng })).toBeCloseTo(1112, 0);
  });

  it('xấp xỉ phẳng sai lệch không đáng kể so với haversine ở quy mô thành phố', () => {
    const target = { lat: 10.8231, lng: 106.6297 };
    const exact = haversineMeters(saigon, target);
    expect(Math.abs(approxDistanceMeters(saigon, target) - exact) / exact).toBeLessThan(0.005);
  });

  it('một độ kinh độ ngắn dần khi lên vĩ độ cao', () => {
    expect(metersPerDegreeLng(0)).toBeCloseTo(111_320, 0);
    expect(metersPerDegreeLng(60)).toBeCloseTo(55_660, 0);
  });

  it('hướng đi theo bốn phương chính', () => {
    expect(bearingDegrees(saigon, { lat: saigon.lat + 0.01, lng: saigon.lng })).toBeCloseTo(0, 1);
    expect(bearingDegrees(saigon, { lat: saigon.lat, lng: saigon.lng + 0.01 })).toBeCloseTo(90, 1);
    expect(bearingDegrees(saigon, { lat: saigon.lat - 0.01, lng: saigon.lng })).toBeCloseTo(180, 1);
    expect(bearingDegrees(saigon, { lat: saigon.lat, lng: saigon.lng - 0.01 })).toBeCloseTo(270, 1);
  });

  it('dời điểm đúng quãng và đúng hướng', () => {
    const moved = offsetByMeters(saigon, 90, 500);
    expect(approxDistanceMeters(saigon, moved)).toBeCloseTo(500, 0);
    expect(bearingDegrees(saigon, moved)).toBeCloseTo(90, 0);
  });
});
