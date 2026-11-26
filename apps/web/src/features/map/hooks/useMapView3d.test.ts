// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useMapView3d } from './useMapView3d';

afterEach(() => window.localStorage.clear());

describe('useMapView3d', () => {
  it('mặc định 2D và ghi nhớ lựa chọn 3D', () => {
    const first = renderHook(() => useMapView3d());
    expect(first.result.current.view3d).toBe(false);
    act(() => first.result.current.setView3d(true));
    expect(first.result.current.view3d).toBe(true);
    expect(renderHook(() => useMapView3d()).result.current.view3d).toBe(true);
  });
});
