import { describe, expect, it } from 'vitest';
import { circlePolygon } from './circlePolygon';
import { haversineMeters } from './distance';

describe('circlePolygon', () => {
  it('vòng khép kín, mọi đỉnh cách tâm đúng bán kính (sai số < 1%)', () => {
    const center = { lat: 10.77, lng: 106.69 };
    const [ring] = circlePolygon(center, 280, 32).coordinates;
    expect(ring).toHaveLength(33);
    expect(ring![0]).toEqual(ring![32]);
    for (const [lng, lat] of ring!) {
      const distance = haversineMeters(center, { lat: lat!, lng: lng! });
      expect(Math.abs(distance - 280)).toBeLessThan(2.8);
    }
  });
});
