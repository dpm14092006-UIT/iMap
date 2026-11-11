import { describe, expect, it } from 'vitest';
import { IncidentAheadDetector } from './IncidentAheadDetector';
import { RoutePath } from './RoutePath';

// Tuyến thẳng hướng Bắc dài ~2,2 km ([lat, lng]); 0.001° vĩ độ ≈ 111 m.
const path = new RoutePath([
  {
    points: [
      [10.77, 106.7],
      [10.78, 106.7],
      [10.79, 106.7],
    ],
  },
]);
const onRouteAt = (meters: number) => ({ lat: 10.77 + meters / 111_320, lng: 106.7 });

describe('IncidentAheadDetector', () => {
  it('tìm sự cố gần nhất nằm trên tuyến ở phía trước', () => {
    const detector = new IncidentAheadDetector();
    const far = { id: 'far', title: 'Kẹt xe', ...onRouteAt(1300) };
    const near = { id: 'near', title: 'Ngập', ...onRouteAt(900) };
    const found = detector.findAhead(path, 400, [far, near]);
    expect(found?.incident.id).toBe('near');
    expect(found?.distanceAheadMeters).toBeCloseTo(500, -1);
  });

  it('bỏ qua sự cố đã đi qua, quá xa phía trước hoặc cách xa tuyến', () => {
    const detector = new IncidentAheadDetector();
    const behind = { id: 'behind', title: 'Tai nạn', ...onRouteAt(100) };
    const tooFar = { id: 'too-far', title: 'Thi công', ...onRouteAt(2100) };
    const offRoad = { id: 'off', title: 'Vật cản', lat: onRouteAt(800).lat, lng: 106.702 }; // lệch ~220 m
    expect(detector.findAhead(path, 400, [behind, tooFar, offRoad])).toBeNull();
  });

  it('mỗi sự cố chỉ báo một lần; chuyến mới thì báo lại', () => {
    const detector = new IncidentAheadDetector();
    const incident = { id: 'x', title: 'Đường đóng', ...onRouteAt(1000) };
    expect(detector.findAhead(path, 200, [incident])).not.toBeNull();
    detector.markHandled('x');
    expect(detector.findAhead(path, 250, [incident])).toBeNull();
    detector.reset();
    expect(detector.findAhead(path, 250, [incident])).not.toBeNull();
  });
});
