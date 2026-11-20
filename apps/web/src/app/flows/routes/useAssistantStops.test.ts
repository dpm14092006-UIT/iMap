// @vitest-environment jsdom
import type { RouteStopCandidate } from '@routetwin/shared';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteApiClient } from '../../../features/routing/api/RouteApiClient';
import type { RoutePlan } from '../../../features/routing/types';
import { routePlan } from '../../../testing/fixtures';
import { useAssistantStops } from './useAssistantStops';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const candidate = {
  place: { id: 'fuel', name: 'Trạm xăng', address: '', category: 'fuel', lat: 10.005, lng: 106.005 },
  route: {
    source: 'vietmap',
    distanceMeters: 2500,
    durationSeconds: 420,
    coordinates: [
      [106, 10],
      [106.005, 10.005],
      [106.01, 10.01],
    ],
    instructions: [],
  },
} as unknown as RouteStopCandidate;

function setup(route: RoutePlan) {
  const api = new RouteApiClient();
  const recomputed = { ...routePlan('recomputed'), avoidFerry: route.avoidFerry };
  const createPlan = vi.spyOn(api, 'createPlan').mockResolvedValue(recomputed);
  let current: RoutePlan | null = route;
  const setActiveRoute = vi.fn((next: RoutePlan | null | ((value: RoutePlan | null) => RoutePlan | null)) => {
    current = typeof next === 'function' ? next(current) : next;
  });
  const hook = renderHook(() =>
    useAssistantStops({
      activeRoute: route,
      setActiveRoute,
      routeApi: api,
      showToast: vi.fn(),
      t: (text) => text,
    }),
  );
  return { hook, createPlan, current: () => current };
}

describe('useAssistantStops giữ tùy chọn của tuyến đang xem', () => {
  it('tuyến "nhanh nhất", không tránh phà: dùng luôn tuyến trợ lý đã tính', async () => {
    const { hook, createPlan, current } = setup(routePlan());
    await act(() => hook.result.current.add(candidate, 'route-a'));
    expect(createPlan).not.toHaveBeenCalled();
    expect(current()?.stops.map((stop) => stop.id)).toEqual(['a', 'fuel', 'b']);
  });

  it('tuyến tránh phà: tính lại kèm tránh phà thay vì dùng tuyến trợ lý (có thể đi qua phà)', async () => {
    const { hook, createPlan, current } = setup({ ...routePlan(), avoidFerry: true });
    await act(() => hook.result.current.add(candidate, 'route-a'));
    expect(createPlan).toHaveBeenCalledWith(expect.any(Array), 'car', 'time', true);
    expect(current()?.avoidFerry).toBe(true);
  });

  it('bỏ điểm ghé vẫn giữ tiêu chí và tránh phà', async () => {
    const base = routePlan();
    const route: RoutePlan = {
      ...base,
      objective: 'distance',
      avoidFerry: true,
      stops: [base.stops[0]!, { ...base.stops[0]!, id: 'via' }, base.stops[1]!],
    };
    const { hook, createPlan } = setup(route);
    await act(() => hook.result.current.remove());
    expect(createPlan).toHaveBeenCalledWith([route.stops[0], route.stops[2]], 'car', 'distance', true);
  });
});
