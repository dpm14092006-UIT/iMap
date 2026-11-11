import { describe, expect, it } from 'vitest';
import type { RoutePlan } from '../../map/types';
import type { Place } from '../../places/types';
import { NavigationGuidanceEngine } from './NavigationGuidanceEngine';
import { RoutePath } from './RoutePath';

const place = (id: string, lat: number, lng: number): Place => ({
  id,
  name: id,
  address: '',
  category: '',
  lat,
  lng,
  source: 'map',
});

/** Tuyến thẳng về phía đông dọc vĩ tuyến 10°, dài ≈ 2,19 km, có một điểm dừng ở giữa. */
function eastwardRoute(): RoutePlan {
  const stops = [place('A', 10, 106.01), place('mid', 10, 106.02), place('B', 10, 106.03)];
  return {
    id: 'r',
    kind: 'multi',
    stops,
    legs: [
      {
        nodes: [],
        points: [
          [10, 106.01],
          [10, 106.02],
          [10, 106.03],
        ],
        distanceKm: 2.19,
        durationMin: 5,
        from: stops[0]!,
        to: stops[2]!,
        instructions: [
          { text: 'Đi thẳng', distanceMeters: 1095, sign: 0, streetName: '' },
          { text: 'Rẽ phải', distanceMeters: 1095, sign: 2, streetName: '' },
          { text: 'Đến nơi', distanceMeters: 0, sign: 4, streetName: '' },
        ],
      },
    ],
    distanceKm: 2.19,
    durationMin: 5,
    vehicle: 'motorcycle',
    objective: 'time',
  } as unknown as RoutePlan;
}

describe('NavigationGuidanceEngine', () => {
  const engine = new NavigationGuidanceEngine(eastwardRoute());

  it('đang trên tuyến: đã qua giữa tuyến, chỉ dẫn kế tiếp là bước rẽ phải', () => {
    const guidance = engine.evaluate({ lat: 10, lng: 106.022 }, 10, 0);
    expect(guidance.offRoute).toBe(false);
    expect(guidance.arrived).toBe(false);
    expect(guidance.progressRatio).toBeCloseTo(0.6, 1);
    expect(guidance.distanceRemainingMeters).toBeCloseTo(876, -1);
    expect(guidance.nextInstruction?.text).toBe('Rẽ phải');
  });

  it('cách tuyến vài trăm mét: báo lệch tuyến', () => {
    expect(engine.evaluate({ lat: 10.005, lng: 106.02 }, 10, 0).offRoute).toBe(true);
  });

  it('GPS kém chính xác thì dung sai lệch tuyến rộng hơn', () => {
    // ~110 m lệch: lệch tuyến với GPS tốt, nhưng bình thường với sai số 100 m.
    const point = { lat: 10.001, lng: 106.02 };
    expect(engine.evaluate(point, 10, 0).offRoute).toBe(true);
    expect(engine.evaluate(point, 100, 0).offRoute).toBe(false);
  });

  it('tới điểm cuối: đã đến nơi', () => {
    expect(engine.evaluate({ lat: 10, lng: 106.03 }, 10, 0.9).arrived).toBe(true);
  });

  it('điểm dừng kế tiếp chuyển sang điểm cuối sau khi đi qua điểm giữa', () => {
    expect(engine.evaluate({ lat: 10, lng: 106.015 }, 10, 0).nextStopIndex).toBe(1);
    expect(engine.evaluate({ lat: 10, lng: 106.025 }, 10, 0.5).nextStopIndex).toBe(2);
  });
});

describe('RoutePath', () => {
  it('không có đoạn nào thì không khớp được điểm nào', () => {
    expect(new RoutePath([{ points: [[10, 106]] }]).closest({ lat: 10, lng: 106 })).toBeNull();
  });

  it('minProgress loại các đoạn phía sau', () => {
    const path = new RoutePath([
      {
        points: [
          [10, 106],
          [10, 106.01],
          [10, 106],
        ],
      },
    ]);
    const point = { lat: 10, lng: 106.005 };
    expect(path.closest(point)!.progress).toBeLessThan(path.totalMeters / 2);
    expect(path.closest(point, path.totalMeters / 2)!.progress).toBeGreaterThan(path.totalMeters / 2);
  });
});
