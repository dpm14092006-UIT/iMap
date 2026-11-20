// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routePlan } from '../../../testing/fixtures';
import type { SavedRoute } from '../types';
import { useSavedRoutes } from './useSavedRoutes';

afterEach(cleanup);

describe('saved routes batched interactions', () => {
  it('does not duplicate a storage write during StrictMode render replay', () => {
    const repository = { load: () => [], save: vi.fn((_routes: SavedRoute[]) => true) };
    const { result } = renderHook(() => useSavedRoutes(repository), { wrapper: StrictMode });
    act(() => {
      result.current.save(routePlan());
    });
    expect(repository.save).toHaveBeenCalledOnce();
    expect(result.current.routes).toHaveLength(1);
  });
  it('preserves two distinct saves before React commits a render', () => {
    const repository = { load: () => [], save: vi.fn((_routes: SavedRoute[]) => true) };
    const { result } = renderHook(() => useSavedRoutes(repository));
    const first = routePlan('first');
    const second = { ...routePlan('second'), vehicle: 'motorcycle' as const };
    act(() => {
      result.current.save(first);
      result.current.save(second);
    });
    expect(result.current.routes.map((route) => route.vehicle)).toEqual(['motorcycle', 'car']);
    expect(repository.save.mock.calls.at(-1)?.[0]).toHaveLength(2);
  });

  it('save then remove in the same turn does not restore the previous snapshot', () => {
    const { result } = renderHook(() => useSavedRoutes({ load: () => [], save: () => true }));
    act(() => {
      result.current.save(routePlan('first'));
      result.current.remove('unrelated');
    });
    expect(result.current.routes).toHaveLength(1);
  });

  it('reports storage failure while keeping the unsaved route available in the current session', () => {
    const { result } = renderHook(() => useSavedRoutes({ load: () => [], save: () => false }));
    let saved: boolean | undefined;
    act(() => {
      saved = result.current.save(routePlan());
    });
    expect(saved).toBe(false);
    expect(result.current.routes).toHaveLength(1);
  });
});
