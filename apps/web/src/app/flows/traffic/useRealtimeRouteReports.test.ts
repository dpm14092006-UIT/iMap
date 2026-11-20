// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeTrafficReport } from '../../../features/traffic/hooks/useTrafficReports';
import type { RoutePlan } from '../../../features/routing/types';
import { routePlan } from '../../../testing/fixtures';
import { useRealtimeRouteReports } from './useRealtimeRouteReports';

afterEach(cleanup);

const report: RealtimeTrafficReport = {
  id: '11111111-1111-4111-8111-111111111111',
  incidentType: 'flood',
  severity: 'high',
  vehicleScope: 'both',
  lat: 10.005,
  lng: 106.005,
  status: 'active',
  version: 1,
};

describe('realtime route report lifecycle', () => {
  function setup() {
    const handler = vi.fn();
    const hook = renderHook(
      ({ route }: { route: RoutePlan | null }) => {
        const reports = useRealtimeRouteReports(route);
        reports.setHandler(handler);
        return reports;
      },
      { initialProps: { route: routePlan() as RoutePlan | null } },
    );
    return { ...hook, handler };
  }

  it('deduplicates identical events but delivers a higher version on the same route', () => {
    const { result, handler } = setup();
    act(() => {
      result.current.onRealtimeTrafficReport(report);
      result.current.onRealtimeTrafficReport(report);
      result.current.onRealtimeTrafficReport({ ...report, version: 2 });
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('allows the same report again after closing a trip and opening another', () => {
    const { result, rerender, handler } = setup();
    act(() => result.current.onRealtimeTrafficReport(report));
    rerender({ route: null });
    rerender({ route: routePlan('next-trip') });
    act(() => result.current.onRealtimeTrafficReport(report));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh notification scope when switching directly between routes', () => {
    const { result, rerender, handler } = setup();
    act(() => result.current.onRealtimeTrafficReport(report));
    rerender({ route: routePlan('route-b') });
    act(() => result.current.onRealtimeTrafficReport(report));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not consume a version before a handler has been installed', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useRealtimeRouteReports(routePlan()));
    act(() => result.current.onRealtimeTrafficReport(report));
    result.current.setHandler(handler);
    act(() => result.current.onRealtimeTrafficReport(report));
    expect(handler).toHaveBeenCalledOnce();
  });
});
