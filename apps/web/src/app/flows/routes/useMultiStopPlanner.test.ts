// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type ComponentType, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteApiClient } from '../../../features/routing/api/RouteApiClient';
import type { RoutePlan } from '../../../features/routing/types';
import { deferred, routePlan } from '../../../testing/fixtures';
import type { FeatureKey } from '../../types';
import { useMultiStopPlanner } from './useMultiStopPlanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(wrapper?: ComponentType<PropsWithChildren>) {
  const api = new RouteApiClient();
  const request = deferred<RoutePlan | { error: string }>();
  vi.spyOn(api, 'createOptimizedPlan').mockReturnValue(request.promise);
  const apply = vi.fn();
  const planned = vi.fn();
  const toast = vi.fn();
  const hook = renderHook(
    (panel: FeatureKey | null) =>
      useMultiStopPlanner({
        routeApi: api,
        activePanel: panel,
        activeRoute: null,
        setActiveRoute: apply,
        demoEnabled: false,
        onPlanned: planned,
        showToast: toast,
        t: (text) => text,
      }),
    { initialProps: 'multi' as FeatureKey | null, wrapper },
  );
  const route = routePlan();
  const plan = () => hook.result.current.plan(route.stops[0]!, [route.stops[1]!], 'car', 'time', false);
  return { ...hook, api, request, apply, planned, toast, plan };
}

describe('multi-stop planner request lifecycle', () => {
  it('can finish a current request after StrictMode replays mount effects', async () => {
    const { plan, request, apply, planned } = setup(StrictMode);
    let promise!: ReturnType<typeof plan>;
    act(() => {
      promise = plan();
    });
    apply.mockClear();
    await act(async () => {
      request.resolve(routePlan('finished'));
      await promise;
    });
    expect(apply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'finished' }));
    expect(planned).toHaveBeenCalledOnce();
  });
  it('does not apply a response or show success after unmount', async () => {
    const { plan, request, unmount, apply, planned, toast } = setup();
    let promise!: ReturnType<typeof plan>;
    act(() => {
      promise = plan();
    });
    apply.mockClear();
    unmount();
    request.resolve(routePlan('finished'));
    await act(async () => {
      await promise;
    });
    expect(apply).not.toHaveBeenCalled();
    expect(planned).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('switching to directions invalidates the pending trip', async () => {
    const { plan, request, rerender, apply, planned } = setup();
    let promise!: ReturnType<typeof plan>;
    act(() => {
      promise = plan();
    });
    apply.mockClear();
    rerender('directions');
    request.resolve(routePlan('finished'));
    await act(async () => {
      await promise;
    });
    expect(apply).not.toHaveBeenCalled();
    expect(planned).not.toHaveBeenCalled();
  });

  it('only applies the newest of two responses completing in reverse order', async () => {
    const { api, request, plan, apply } = setup();
    const newer = deferred<RoutePlan>();
    let first!: ReturnType<typeof plan>;
    let second!: ReturnType<typeof plan>;
    act(() => {
      first = plan();
    });
    vi.mocked(api.createOptimizedPlan).mockReturnValue(newer.promise);
    act(() => {
      second = plan();
    });
    apply.mockClear();
    await act(async () => {
      newer.resolve(routePlan('new'));
      await second;
    });
    await act(async () => {
      request.resolve(routePlan('old'));
      await first;
    });
    expect(apply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'new' }));
  });
});
