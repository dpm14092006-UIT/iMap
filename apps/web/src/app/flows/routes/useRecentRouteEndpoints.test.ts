// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRecentPlaces } from '../../../features/places/context/RecentPlacesProvider';
import { routePlan } from '../../../testing/fixtures';
import { useRecentRouteEndpoints } from './useRecentRouteEndpoints';

vi.mock('../../../features/places/context/RecentPlacesProvider', () => ({ useRecentPlaces: vi.fn() }));
afterEach(cleanup);

describe('recent route endpoints account scope', () => {
  it('records the current route for a new account even if both accounts stay authenticated', () => {
    const previous = vi.fn();
    const next = vi.fn();
    const places = { origin: [], destination: [] };
    vi.mocked(useRecentPlaces).mockReturnValue({ enabled: true, places, record: previous, remove: vi.fn() });
    const route = routePlan();
    const { rerender } = renderHook(() => useRecentRouteEndpoints(route));
    expect(previous).toHaveBeenCalledTimes(2);
    vi.mocked(useRecentPlaces).mockReturnValue({ enabled: true, places, record: next, remove: vi.fn() });
    rerender();
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('does not write endpoints again when only the route alternative changes', () => {
    const record = vi.fn();
    vi.mocked(useRecentPlaces).mockReturnValue({
      enabled: true,
      places: { origin: [], destination: [] },
      record,
      remove: vi.fn(),
    });
    const { rerender } = renderHook((route) => useRecentRouteEndpoints(route), { initialProps: routePlan() });
    rerender(routePlan('another-alternative'));
    expect(record).toHaveBeenCalledTimes(2);
  });
});
