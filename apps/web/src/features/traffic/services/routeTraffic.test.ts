import { describe, expect, it } from 'vitest';
import type { RoutePlan } from '../../map/types';
import { ROUTE_ALERT_CORRIDOR_METERS, shouldNotifyTrafficReportOnRoute } from './routeTraffic';

const route = {
  legs: [
    {
      points: [
        [10, 106.01],
        [10, 106.03],
      ],
    },
  ],
} as unknown as RoutePlan;

describe('traffic route alerts', () => {
  it('alerts for active reports on the prepared or navigating route', () => {
    expect(shouldNotifyTrafficReportOnRoute(route, { lat: 10, lng: 106.02, status: 'active' })).toBe(true);
  });

  it('ignores reports outside the 180 m route corridor', () => {
    expect(ROUTE_ALERT_CORRIDOR_METERS).toBe(180);
    expect(shouldNotifyTrafficReportOnRoute(route, { lat: 10.002, lng: 106.02, status: 'active' })).toBe(
      false,
    );
  });

  it('does not alert for cleared or expired reports', () => {
    expect(shouldNotifyTrafficReportOnRoute(route, { lat: 10, lng: 106.02, status: 'cleared' })).toBe(false);
    expect(shouldNotifyTrafficReportOnRoute(route, { lat: 10, lng: 106.02, status: 'expired' })).toBe(false);
  });
});
