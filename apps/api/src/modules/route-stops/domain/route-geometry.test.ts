import { describe, expect, it } from 'vitest';
import { distanceMeters, projectOnRoute, routeBounds } from './route-geometry.js';
describe('route geometry [lng,lat]', () => {
  it('projects onto the middle of a segment, not only its vertices', () => {
    const result = projectOnRoute(
      [106.705, 10.001],
      [
        [106.7, 10],
        [106.71, 10],
      ],
    );
    expect(result.distance).toBeCloseTo(111.2, 0);
    expect(result.progress).toBeGreaterThan(500);
    expect(result.progress).toBeLessThan(600);
  });
  it('handles identical consecutive vertices', () => {
    const result = projectOnRoute(
      [106.7, 10],
      [
        [106.7, 10],
        [106.7, 10],
        [106.71, 10],
      ],
    );
    expect(result).toEqual({ distance: 0, progress: 0 });
  });
  it('uses meter padding rather than swapping latitude and longitude', () => {
    const bounds = routeBounds(
      [
        [106.7, 10.7],
        [106.8, 10.8],
      ],
      1500,
    );
    expect(bounds.south).toBeLessThan(10.7);
    expect(bounds.north).toBeGreaterThan(10.8);
    expect(bounds.west).toBeLessThan(106.7);
    expect(bounds.east).toBeGreaterThan(106.8);
    expect(distanceMeters([106.7, 10.7], [106.7, 10.7])).toBe(0);
  });
});
