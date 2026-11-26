// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DirectionsController } from '../../../features/routing/hooks/useDirections';
import type { MapController } from '../../../features/map/services/MapController';
import { placeFromPoint } from '../../../features/places/services/placeFromPoint';
import type { Place } from '../../../features/places/types';
import { deferred, routePlan } from '../../../testing/fixtures';
import { useEndpointPicker } from './useEndpointPicker';

vi.mock('../../../features/places/services/placeFromPoint', () => ({ placeFromPoint: vi.fn() }));
beforeEach(() => {
  vi.mocked(placeFromPoint).mockReset();
});
afterEach(cleanup);

function setup() {
  const first = routePlan().stops[0]!;
  const setOrigin = vi.fn();
  const setDestination = vi.fn();
  const flyTo = vi.fn();
  const locate = vi.fn(async () => ({ point: first, accuracyMeters: 5 }));
  const hook = renderHook(
    ({ origin }: { origin: Place | null }) =>
      useEndpointPicker({
        directions: {
          origin,
          destination: null,
          setOrigin,
          setDestination,
        } as unknown as DirectionsController,
        locate,
        mapController: { current: { flyTo } as unknown as MapController },
        showToast: vi.fn(),
        t: (text) => text,
      }),
    { initialProps: { origin: null as Place | null } },
  );
  return { ...hook, first, locate, setOrigin, setDestination, flyTo };
}

describe('endpoint lookup lifecycle', () => {
  it('does not mutate directions after unmount', async () => {
    const response = deferred<Place>();
    vi.mocked(placeFromPoint).mockReturnValue(response.promise);
    const { result, first, unmount, setOrigin } = setup();
    const lookup = result.current.pickPoint('origin', first);
    unmount();
    response.resolve(first);
    await act(async () => {
      await lookup;
    });
    expect(setOrigin).not.toHaveBeenCalled();
  });

  it('a manual selection cancels both the stale GPS assignment and its camera movement', async () => {
    const response = deferred<Place>();
    vi.mocked(placeFromPoint).mockReturnValue(response.promise);
    const { result, first, rerender, setOrigin, flyTo } = setup();
    let lookup!: Promise<void>;
    act(() => {
      lookup = result.current.useMyLocationAsOrigin();
    });
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ origin: { ...first, id: 'manually-selected' } });
    await act(async () => {
      response.resolve(first);
      await lookup;
    });
    expect(setOrigin).not.toHaveBeenCalled();
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('keeps origin and destination requests independent and ignores the older origin', async () => {
    const old = deferred<Place>();
    const newest = deferred<Place>();
    const destination = deferred<Place>();
    vi.mocked(placeFromPoint)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(destination.promise)
      .mockReturnValueOnce(newest.promise);
    const { result, first, setOrigin, setDestination } = setup();
    const requests = [
      result.current.pickPoint('origin', first),
      result.current.pickPoint('destination', first),
      result.current.pickPoint('origin', first),
    ];
    const newPoint = { ...first, id: 'new' };
    await act(async () => {
      newest.resolve(newPoint);
      destination.resolve(first);
      old.resolve({ ...first, id: 'old' });
      await Promise.all(requests);
    });
    expect(setOrigin).toHaveBeenCalledExactlyOnceWith(newPoint);
    expect(setDestination).toHaveBeenCalledExactlyOnceWith(first);
  });
});
