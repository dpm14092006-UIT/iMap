// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapController } from '../../../features/map/services/MapController';
import { useMapViewport } from './useMapViewport';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('map viewport timers', () => {
  it('cancels a pending camera movement when the hook unmounts', async () => {
    vi.useFakeTimers();
    const flyTo = vi.fn();
    const controller = { current: { flyTo } as unknown as MapController };
    const { result, unmount } = renderHook(() => useMapViewport(controller, false));
    act(() => result.current.focusAfterPanel({ lat: 10, lng: 106 }));
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('restarts the fallback delay for the latest point instead of letting the previous timer fire it early', async () => {
    vi.useFakeTimers();
    const flyTo = vi.fn();
    const controller = { current: { flyTo } as unknown as MapController };
    const { result } = renderHook(() => useMapViewport(controller, false));
    act(() => result.current.focusAfterPanel({ lat: 10, lng: 106 }));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    const latest = { lat: 11, lng: 107 };
    act(() => result.current.focusAfterPanel(latest, 16));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(flyTo).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(flyTo).toHaveBeenCalledExactlyOnceWith(latest, 16);
  });
});
