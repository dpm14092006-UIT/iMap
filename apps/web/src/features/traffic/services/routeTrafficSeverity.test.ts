import { describe, expect, it } from 'vitest';
import { toTrafficMapLayer } from '../../map/layers/trafficMapLayer';
import type { RoutePlan } from '../../map/types';
import { routeTrafficSeverity } from './routeTraffic';

const route = {
  vehicle: 'car',
  legs: [
    {
      points: [
        [10, 106.01],
        [10, 106.03],
      ],
    },
  ],
} as unknown as RoutePlan;

const incident = (
  id: string,
  severity: 'low' | 'medium' | 'high',
  lat: number,
  status: 'active' | 'cleared' = 'active',
) => ({
  id,
  incidentType: 'traffic_jam',
  severity,
  vehicleScope: 'both' as const,
  title: 'Kẹt xe',
  lat,
  lng: 106.02,
  status,
});

describe('routeTrafficSeverity', () => {
  it('trả null khi không có sự cố gần tuyến', () => {
    expect(routeTrafficSeverity(route, toTrafficMapLayer([]))).toBeNull();
    expect(routeTrafficSeverity(route, toTrafficMapLayer([incident('far', 'high', 10.01)]))).toBeNull();
  });

  it('lấy mức nặng nhất của sự cố còn hoạt động trong hành lang', () => {
    const layer = toTrafficMapLayer([
      incident('a', 'low', 10),
      incident('b', 'medium', 10.0005),
      incident('c', 'high', 10, 'cleared'),
    ]);
    expect(routeTrafficSeverity(route, layer)).toBe('medium');
  });
});
