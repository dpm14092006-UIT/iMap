// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RerouteResult } from '@routetwin/shared';
import { rerouteApi } from '../../../features/guidance/api/RerouteApiClient';
import type { useNavigationSession } from '../../../features/guidance/hooks/useNavigationSession';
import { deferred, routePlan, routeResult } from '../../../testing/fixtures';
import { useNavigationRerouting } from './useNavigationRerouting';

vi.mock('../../../features/guidance/api/RerouteApiClient', () => ({ rerouteApi: { reroute: vi.fn() } }));
beforeEach(() => {
  vi.mocked(rerouteApi.reroute).mockReset();
});
afterEach(cleanup);

function setup() {
  const navigation = {
    route: routePlan(),
    status: 'navigating',
    location: { lat: 10, lng: 106 },
    nextStopIndex: 1,
    offRoute: false,
    offRouteFixes: 0,
  } as ReturnType<typeof useNavigationSession>;
  const onRerouted = vi.fn();
  const showToast = vi.fn();
  const hook = renderHook(
    (session) =>
      useNavigationRerouting({
        navigation: session,
        routeIncidents: [],
        onRerouted,
        showToast,
        t: (text) => text,
      }),
    { initialProps: navigation },
  );
  return { ...hook, navigation, onRerouted, showToast };
}

const response = (): RerouteResult => ({
  route: routeResult(),
  strategy: 'direct',
  blockedCount: 0,
  candidatesChecked: 1,
});

describe('navigation rerouting concurrency', () => {
  it('starts only one paid request for two calls before a render', async () => {
    const pending = deferred<RerouteResult>();
    vi.mocked(rerouteApi.reroute).mockReturnValue(pending.promise);
    const { result, onRerouted } = setup();
    let calls!: Promise<void>[];
    act(() => {
      calls = [result.current.recalculate(), result.current.recalculate()];
    });
    expect(rerouteApi.reroute).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve(response());
      await Promise.all(calls);
    });
    expect(onRerouted).toHaveBeenCalledOnce();
  });

  it('does not apply a reroute or toast after unmount', async () => {
    const pending = deferred<RerouteResult>();
    vi.mocked(rerouteApi.reroute).mockReturnValue(pending.promise);
    const { result, unmount, onRerouted, showToast } = setup();
    let call!: Promise<void>;
    act(() => {
      call = result.current.recalculate();
    });
    unmount();
    await act(async () => {
      pending.resolve(response());
      await call;
    });
    expect(onRerouted).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('does not show an obsolete error after the user switches routes', async () => {
    const pending = deferred<RerouteResult>();
    vi.mocked(rerouteApi.reroute).mockReturnValue(pending.promise);
    const { result, rerender, navigation, showToast } = setup();
    let call!: Promise<void>;
    act(() => {
      call = result.current.recalculate();
    });
    rerender({ ...navigation, route: routePlan('new-trip') });
    await act(async () => {
      pending.reject(new Error('old request failed'));
      await call;
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('discards a successful result after navigation has stopped', async () => {
    const pending = deferred<RerouteResult>();
    vi.mocked(rerouteApi.reroute).mockReturnValue(pending.promise);
    const { result, rerender, navigation, onRerouted } = setup();
    let call!: Promise<void>;
    act(() => {
      call = result.current.recalculate();
    });
    rerender({ ...navigation, route: null, status: 'idle' });
    await act(async () => {
      pending.resolve(response());
      await call;
    });
    expect(onRerouted).not.toHaveBeenCalled();
  });
});
