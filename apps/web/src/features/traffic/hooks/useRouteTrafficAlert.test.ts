// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RerouteResult } from '@routetwin/shared';
import { rerouteApi } from '../../guidance/api/RerouteApiClient';
import { deferred, routePlan, routeResult } from '../../../testing/fixtures';
import { REROUTE_DECISION_MS, useRouteTrafficAlert } from './useRouteTrafficAlert';

vi.mock('../../guidance/api/RerouteApiClient', () => ({ rerouteApi: { reroute: vi.fn() } }));
vi.mock('../../notifications/services/alertFeedback', () => ({
  playAlertFeedback: vi.fn(),
  showLocalSystemNotification: vi.fn(),
}));

const incident = { id: 'incident-a', lat: 10.005, lng: 106.005, title: 'Flood', severity: 'high' as const };
const response = (): RerouteResult => ({
  route: routeResult(),
  strategy: 'alternative',
  blockedCount: 0,
  candidatesChecked: 2,
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.mocked(rerouteApi.reroute).mockReset();
});

function setup() {
  const onAccept = vi.fn();
  const options: Parameters<typeof useRouteTrafficAlert>[0] = {
    route: routePlan(),
    isNavigating: false,
    location: null,
    nextStopIndex: 1,
    remainingMinutes: 5,
    otherIncidents: [],
    pushActive: true,
    onAccept,
    notificationText: () => ({ title: '', body: '' }),
  };
  return {
    onAccept,
    options,
    ...renderHook((props) => useRouteTrafficAlert(props), { initialProps: options }),
  };
}

describe('reroute offer lifecycle', () => {
  it('invalidates a pending offer when the active route changes directly', async () => {
    const pending = deferred<RerouteResult>();
    vi.mocked(rerouteApi.reroute).mockReturnValue(pending.promise);
    const { result, rerender, options, onAccept } = setup();
    act(() => result.current.trigger(incident, 100));
    expect(result.current.alert?.offer.status).toBe('computing');
    rerender({ ...options, route: routePlan('another-route') });
    await act(async () => {
      pending.resolve(response());
      await pending.promise;
    });
    act(() => result.current.accept());
    expect(onAccept).not.toHaveBeenCalled();
    expect(result.current.alert).toBeNull();
  });

  it('accepting twice before a render applies the alternative only once', async () => {
    vi.mocked(rerouteApi.reroute).mockResolvedValue(response());
    const { result, onAccept } = setup();
    await act(async () => result.current.trigger(incident, 100));
    expect(result.current.alert?.offer.status).toBe('ready');
    act(() => {
      result.current.accept();
      result.current.accept();
    });
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('forgets offered incidents when moving directly to another trip', async () => {
    vi.mocked(rerouteApi.reroute).mockResolvedValue(response());
    const { result, rerender, options } = setup();
    await act(async () => result.current.trigger(incident, 100));
    rerender({ ...options, route: routePlan('another-route') });
    await act(async () => result.current.trigger(incident, 100));
    expect(rerouteApi.reroute).toHaveBeenCalledTimes(2);
    expect(result.current.alert?.offer.status).toBe('ready');
  });

  it('keeps the current route at the deadline and prevents accepting an expired offer', async () => {
    vi.useFakeTimers();
    vi.mocked(rerouteApi.reroute).mockResolvedValue(response());
    const { result, onAccept } = setup();
    await act(async () => result.current.trigger(incident, 100));
    await act(async () => vi.advanceTimersByTimeAsync(REROUTE_DECISION_MS));
    act(() => result.current.accept());
    expect(result.current.alert?.decision).toBe('kept');
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('closing an offer discards both late success and late errors', async () => {
    const pending = deferred<RerouteResult>();
    vi.mocked(rerouteApi.reroute).mockReturnValue(pending.promise);
    const { result } = setup();
    act(() => result.current.trigger(incident, 100));
    act(() => result.current.close());
    const settled = pending.promise.catch(() => undefined);
    await act(async () => {
      pending.reject(new Error('offline'));
      await settled;
    });
    expect(result.current.alert).toBeNull();
  });
});
