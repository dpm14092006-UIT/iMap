import { describe, expect, it } from 'vitest';
import type { Coordinate } from '../../features/map/types';
import { distanceToPathMeters, pathLengthMeters, pointAtFraction, progressAlongPath } from './path';

const path: Coordinate[] = [
  [10, 106],
  [10, 106.01],
  [10.01, 106.01],
];

describe('path helpers', () => {
  it('tính chiều dài và điểm theo tỉ lệ', () => {
    expect(pathLengthMeters(path)).toBeGreaterThan(2000);
    expect(pointAtFraction(path, 0)).toEqual([10, 106]);
    expect(pointAtFraction(path, 1)).toEqual([10.01, 106.01]);
    const middle = pointAtFraction(path, 0.5);
    expect(middle[0]).toBeGreaterThanOrEqual(10);
    expect(middle[1]).toBeLessThanOrEqual(106.0101);
  });

  it('tính khoảng cách vuông góc tới đường', () => {
    expect(distanceToPathMeters(path, { lat: 10, lng: 106.005 })).toBeLessThan(1);
    const off = distanceToPathMeters(path, { lat: 10.001, lng: 106.005 });
    expect(off).toBeGreaterThan(100);
    expect(off).toBeLessThan(120);
  });

  it('xác định vị trí hình chiếu dọc đường', () => {
    expect(progressAlongPath(path, { lat: 10, lng: 106 })).toBeCloseTo(0, 2);
    expect(progressAlongPath(path, { lat: 10.005, lng: 106.011 })).toBeGreaterThan(0.6);
    expect(progressAlongPath(path, { lat: 10.002, lng: 106.003 })).toBeLessThan(0.3);
    expect(progressAlongPath(path, { lat: 10.01, lng: 106.01 })).toBeCloseTo(1, 2);
  });
});
