// @vitest-environment jsdom
import type { TrafficReportBounds, TrafficReportDto } from '@routetwin/shared';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../../testing/fixtures';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import { trafficApi } from '../api/trafficApi';
import { useTrafficReports } from './useTrafficReports';

vi.mock('../api/trafficApi', () => ({
  trafficApi: { list: vi.fn(), create: vi.fn(), clearance: vi.fn() },
  trafficPhotos: {},
  vietnamBounds: { minLat: 7, minLng: 102, maxLat: 24, maxLng: 117 },
}));
vi.mock('../../auth/services/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

const bounds: TrafficReportBounds = { minLat: 10, maxLat: 10.02, minLng: 106, maxLng: 106.02 };
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(trafficApi.list).mockReset().mockResolvedValue([]);
  vi.mocked(getSupabaseClient).mockReset().mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function tick(ms = 400) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('traffic fetch budget while following GPS', () => {
  it('falls back to the exact viewport when the prefetch hits the RPC row cap', async () => {
    vi.mocked(trafficApi.list)
      .mockResolvedValueOnce(
        Array.from({ length: 200 }, (_, index) => ({ id: `buffer-${index}` }) as TrafficReportDto),
      )
      .mockResolvedValue([]);
    const { result } = renderHook(() => useTrafficReports(null, null, bounds));
    await tick();
    expect(trafficApi.list).toHaveBeenLastCalledWith(undefined, bounds);
    expect(result.current.reports).toEqual([]);
  });

  it('restores buffered fetching after leaving a dense area', async () => {
    vi.mocked(trafficApi.list)
      .mockResolvedValueOnce(
        Array.from({ length: 200 }, (_, index) => ({ id: `buffer-${index}` }) as TrafficReportDto),
      )
      .mockResolvedValue([]);
    const { rerender } = renderHook((viewport) => useTrafficReports(null, null, viewport), {
      initialProps: bounds,
    });
    await tick();
    const next = { minLat: 12, maxLat: 12.02, minLng: 108, maxLng: 108.02 };
    rerender(next);
    await tick();
    const query = vi.mocked(trafficApi.list).mock.calls.at(-1)?.[1];
    expect(query!.minLat).toBeLessThan(next.minLat);
    expect(query!.maxLat).toBeGreaterThan(next.maxLat);
  });
  it('reuses fetched coverage across 350 GPS camera movements', async () => {
    const { rerender } = renderHook((viewport) => useTrafficReports(null, null, viewport), {
      initialProps: bounds,
    });
    await tick();
    for (let frame = 1; frame <= 350; frame++) {
      const offset = frame * 0.00008;
      rerender({ ...bounds, minLng: bounds.minLng + offset, maxLng: bounds.maxLng + offset });
      await tick();
    }
    expect(vi.mocked(trafficApi.list).mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('fetches when panning outside coverage and when zooming into a much smaller area', async () => {
    const { rerender } = renderHook((viewport) => useTrafficReports(null, null, viewport), {
      initialProps: bounds,
    });
    await tick();
    const initialCount = vi.mocked(trafficApi.list).mock.calls.length;
    rerender({ minLat: 11, maxLat: 11.02, minLng: 107, maxLng: 107.02 });
    await tick();
    expect(trafficApi.list).toHaveBeenCalledTimes(initialCount + 1);
    rerender({ minLat: 11.009, maxLat: 11.011, minLng: 107.009, maxLng: 107.011 });
    await tick();
    expect(trafficApi.list).toHaveBeenCalledTimes(initialCount + 2);
  });

  it('never sends padded bounds wider than the server limit or outside world coordinates', async () => {
    const nearEdge = { minLat: 88.1, maxLat: 90, minLng: 178.1, maxLng: 180 };
    renderHook(() => useTrafficReports(null, null, nearEdge));
    await tick();
    for (const [, query] of vi.mocked(trafficApi.list).mock.calls) {
      expect(query!.maxLat - query!.minLat).toBeLessThanOrEqual(2);
      expect(query!.maxLng - query!.minLng).toBeLessThanOrEqual(2);
      expect(query!.maxLat).toBeLessThanOrEqual(90);
      expect(query!.maxLng).toBeLessThanOrEqual(180);
    }
    expect(trafficApi.list).toHaveBeenCalled();
  });

  it('switching accounts refreshes data even when the viewport has not changed', async () => {
    const { rerender } = renderHook((token: string) => useTrafficReports(token, token, bounds), {
      initialProps: 'a',
    });
    await tick();
    vi.mocked(trafficApi.list).mockClear();
    rerender('b');
    await tick();
    expect(trafficApi.list).toHaveBeenCalledWith('b', expect.any(Object));
  });

  it('drops the old area response when a new area completes first', async () => {
    const old = deferred<TrafficReportDto[]>();
    vi.mocked(trafficApi.list).mockReturnValueOnce(old.promise).mockResolvedValue([]);
    const { result, rerender } = renderHook((viewport) => useTrafficReports(null, null, viewport), {
      initialProps: bounds,
    });
    rerender({ minLat: 11, maxLat: 11.02, minLng: 107, maxLng: 107.02 });
    await tick();
    await act(async () => {
      old.resolve([{ id: 'old-area' } as TrafficReportDto]);
      await old.promise;
    });
    expect(result.current.reports).toEqual([]);
  });

  it('realtime alerts remain immediate while a burst causes only one list refresh', async () => {
    let broadcast!: (event: { payload: unknown }) => void;
    const channel = {
      on: vi.fn((_kind: string, _filter: object, listener: typeof broadcast) => {
        broadcast = listener;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    vi.mocked(getSupabaseClient).mockResolvedValue({
      channel: () => channel,
      removeChannel: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof getSupabaseClient>>);
    const alert = vi.fn();
    renderHook(() => useTrafficReports(null, null, bounds, true, alert));
    await tick();
    vi.mocked(trafficApi.list).mockClear();
    act(() => {
      for (let index = 0; index < 20; index++)
        broadcast({
          payload: {
            id: `report-${index}`,
            incidentType: 'flood',
            severity: 'high',
            status: 'active',
            lat: 10.01,
            lng: 106.01,
          },
        });
    });
    expect(alert).toHaveBeenCalledTimes(20);
    expect(trafficApi.list).not.toHaveBeenCalled();
    await tick(500);
    expect(trafficApi.list).toHaveBeenCalledOnce();
  });
});
