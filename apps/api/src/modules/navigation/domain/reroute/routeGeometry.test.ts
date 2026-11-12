import { describe, expect, it } from 'vitest';
import { haversineMeters } from '../../../../shared/geo/haversine.js';
import { detourPoints, distanceToSegmentMeters, nearestSegment, routePassesNear } from './routeGeometry.js';

// Tuyến thẳng hướng Bắc dài ~1,1 km dọc kinh độ 106.70 ([lng, lat]).
const line: [number, number][] = [
  [106.7, 10.77],
  [106.7, 10.775],
  [106.7, 10.78],
];

describe('routeGeometry', () => {
  it('khoảng cách tới đoạn thẳng: điểm lệch ngang 0.001° kinh độ ≈ 109 m', () => {
    expect(
      distanceToSegmentMeters(
        { lat: 10.775, lng: 106.701 },
        { lat: 10.77, lng: 106.7 },
        { lat: 10.78, lng: 106.7 },
      ),
    ).toBeCloseTo(109.4, 0);
  });

  it('điểm nằm ngoài hai đầu đoạn thì đo tới đầu mút gần nhất', () => {
    const distance = distanceToSegmentMeters(
      { lat: 10.79, lng: 106.7 },
      { lat: 10.77, lng: 106.7 },
      { lat: 10.78, lng: 106.7 },
    );
    expect(distance).toBeCloseTo(haversineMeters({ lat: 10.79, lng: 106.7 }, { lat: 10.78, lng: 106.7 }), -1);
  });

  it('tìm đúng đoạn gần nhất và biết tuyến có đi qua sự cố không', () => {
    expect(nearestSegment({ lat: 10.778, lng: 106.7002 }, line).index).toBe(1);
    expect(routePassesNear(line, { lat: 10.776, lng: 106.7003 }, 60)).toBe(true); // lệch ~33 m
    expect(routePassesNear(line, { lat: 10.776, lng: 106.702 }, 60)).toBe(false); // lệch ~219 m
  });

  it('hai điểm vòng tránh nằm hai bên tuyến, đúng khoảng cách yêu cầu', () => {
    const incident = { lat: 10.775, lng: 106.7 };
    const [left, right] = detourPoints(line, incident, 300);
    expect(haversineMeters(incident, left)).toBeCloseTo(300, -1);
    expect(haversineMeters(incident, right)).toBeCloseTo(300, -1);
    expect(Math.sign(left.lng - 106.7)).toBe(-Math.sign(right.lng - 106.7)); // hai bên đường
    expect(left.lat).toBeCloseTo(incident.lat, 5); // vuông góc với hướng đường Bắc–Nam
  });
});
