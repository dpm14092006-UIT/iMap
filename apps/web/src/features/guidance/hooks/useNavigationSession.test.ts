// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routePlan } from '../../../testing/fixtures';
import { TestGeolocation } from '../../../testing/geolocation';
import { useNavigationSession } from './useNavigationSession';
let gps: TestGeolocation;
beforeEach(() => {
  gps = new TestGeolocation();
  vi.stubGlobal('navigator', { geolocation: gps });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('device GPS navigation session', () => {
  it('keeps GPS off until the user explicitly starts a journey', () => {
    const { result } = renderHook(useNavigationSession);
    expect(result.current.status).toBe('idle');
    expect(gps.watches).toHaveLength(0);
    act(() => result.current.start(routePlan()));
    expect(gps.watches).toHaveLength(1);
    expect(result.current.status).toBe('locating');
  });
  it('waits for an actual geolocation callback before navigating', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    expect(result.current.location).toBeNull();
    act(() => gps.fix(0));
    expect(result.current.status).toBe('navigating');
    expect(result.current.location).toEqual({ lat: 10, lng: 106 });
  });
  it('keeps waiting for a reliable fix even if the first fix lands at the destination', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    act(() => gps.fix(0, 10.01, 106.01, { accuracy: 300 }));

    expect(result.current.status).toBe('locating');
    expect(result.current.location).toBeNull();
    expect(result.current.displayLocation).toBeNull();
    expect(gps.cleared).toHaveLength(0);

    act(() => gps.fix(0));
    expect(result.current.status).toBe('navigating');
    expect(result.current.error).toBe('');
  });
  it('keeps the last arrow on a poor fix and withholds a GPS origin for rerouting', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    act(() => gps.fix(0, 10.001, 106.003, { heading: 90, speed: 10 }));
    const offRoute = result.current;
    expect(offRoute.offRoute).toBe(true);

    act(() => gps.fix(0, 10.01, 106.01, { accuracy: 300, heading: 180, speed: 50 }));
    expect(result.current).toMatchObject({
      status: 'navigating',
      displayLocation: offRoute.displayLocation,
      headingDegrees: offRoute.headingDegrees,
      progressRatio: offRoute.progressRatio,
      offRoute: true,
      offRouteFixes: offRoute.offRouteFixes,
      location: null,
      speedKph: null,
    });

    act(() => gps.fix(0, 10.002, 106.002));
    expect(result.current.location).toEqual({ lat: 10.002, lng: 106.002 });
    expect(result.current.offRoute).toBe(false);
    expect(result.current.error).toBe('');
  });
  it('stops GPS and ignores already queued callbacks after ending a journey', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    act(() => result.current.stop());
    act(() => gps.fix(0));
    expect(result.current.status).toBe('idle');
    expect(result.current.location).toBeNull();
    expect(gps.cleared).toContain(0);
  });
  it('does not allow a previous journey callback to change the next journey', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan('first')));
    act(() => result.current.start(routePlan('second')));
    act(() => gps.fix(0, 20, 110));
    expect(result.current.route?.id).toBe('second');
    expect(result.current.location).toBeNull();
    act(() => gps.fix(1));
    expect(result.current.status).toBe('navigating');
  });
  it('reports denied permission and stops the watch without starting a simulation', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    act(() => gps.fail(0, 1));
    expect(result.current.status).toBe('error');
    expect(result.current.location).toBeNull();
    expect(gps.cleared).toContain(0);
  });
  it('continues an active journey after transient GPS loss', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    act(() => gps.fix(0));
    act(() => gps.fail(0, 2));
    expect(result.current.status).toBe('navigating');
    expect(result.current.error).not.toBe('');
    act(() => gps.fix(0, 10.001, 106.001));
    expect(result.current.error).toBe('');
  });
  it('stops the watch at arrival', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    act(() => gps.fix(0, 10.01, 106.01));
    expect(result.current.status).toBe('arrived');
    expect(gps.cleared).toContain(0);
  });
  it('changes the route while keeping the same device watch', () => {
    const { result } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    act(() => gps.fix(0));
    act(() => result.current.updateRoute(routePlan('rerouted')));
    expect(gps.watches).toHaveLength(1);
    expect(result.current.route?.id).toBe('rerouted');
    expect(result.current.offRoute).toBe(false);
  });
  it('clears GPS on unmount', () => {
    const { result, unmount } = renderHook(useNavigationSession);
    act(() => result.current.start(routePlan()));
    unmount();
    expect(gps.cleared).toContain(0);
  });
  it('exposes no demo or source-switching controls', () => {
    const { result } = renderHook(useNavigationSession);
    for (const key of ['mode', 'setMode', 'isDemoPaused', 'toggleDemoPause', 'simulateWrongTurn'])
      expect(result.current).not.toHaveProperty(key);
  });
});
