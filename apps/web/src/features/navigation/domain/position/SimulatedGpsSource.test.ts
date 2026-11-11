import { describe, expect, it } from 'vitest';
import type { RoutePlan } from '../../../map/types';
import { Geodesy } from '../Geodesy';
import { RoutePath } from '../RoutePath';
import { SimulatedGpsSource } from './SimulatedGpsSource';

// Tuyến thẳng hướng Bắc dài ~2,2 km ([lat, lng]).
const points: [number, number][] = [
  [10.77, 106.7],
  [10.78, 106.7],
  [10.79, 106.7],
];
const route = { legs: [{ points }] } as unknown as RoutePlan;
const path = new RoutePath(route.legs);

describe('SimulatedGpsSource (GPS giả)', () => {
  it('bắt đầu ở đầu tuyến và mỗi nhịp tiến thêm metersPerTick, hướng đi là Bắc', () => {
    const source = new SimulatedGpsSource(route);
    expect(source.currentPosition().lat).toBeCloseTo(10.77, 5);
    source.step();
    source.step();
    const fix = source.currentPosition();
    expect(path.closest(fix)!.progress).toBeCloseTo(80, 0);
    expect(fix.headingDegrees).toBeCloseTo(0, 0);
  });

  it('tạm dừng thì đứng yên', () => {
    const source = new SimulatedGpsSource(route);
    source.setPaused(true);
    source.step();
    expect(path.closest(source.currentPosition())!.progress).toBeCloseTo(0, 0);
  });

  it('rẽ nhầm: lệch dần sang phải hướng đi (phía Đông), tối đa 150 m', () => {
    const source = new SimulatedGpsSource(route);
    source.step();
    source.deviate();
    for (let i = 0; i < 10; i++) source.step();
    const fix = source.currentPosition();
    expect(path.closest(fix)!.distance).toBeCloseTo(150, 0);
    expect(fix.lng).toBeGreaterThan(106.7);
  });

  it('chuyển từ Thật sang Demo: bắt đầu từ điểm trên tuyến gần vị trí GPS nhất', () => {
    const source = new SimulatedGpsSource(route, { lat: 10.78, lng: 106.7005 });
    expect(Geodesy.distanceMeters(source.currentPosition(), { lat: 10.78, lng: 106.7 })).toBeLessThan(1);
  });

  it('sau khi tính lại tuyến: chạy theo tuyến mới và thôi lệch', () => {
    const source = new SimulatedGpsSource(route);
    source.deviate();
    source.step();
    source.followRoute({
      legs: [
        {
          points: [
            [10.8, 106.71],
            [10.81, 106.71],
          ],
        },
      ],
    } as unknown as RoutePlan);
    const fix = source.currentPosition();
    expect(fix.lat).toBeCloseTo(10.8, 5);
    expect(fix.lng).toBeCloseTo(106.71, 5);
  });
});
