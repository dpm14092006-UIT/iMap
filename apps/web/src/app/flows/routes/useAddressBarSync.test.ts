// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressBarState } from '../../../features/routing/domain/routeShareLink';
import { useAddressBarSync } from './useAddressBarSync';

const place = { name: 'Chợ Bến Thành', lat: 10.7721, lng: 106.6983 };

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('useAddressBarSync', () => {
  it('đổi URL bằng replaceState (không thêm lịch sử) theo thứ đang xem', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook(({ state }: { state: AddressBarState }) => useAddressBarSync(state), {
      initialProps: { state: { kind: 'place', place } as AddressBarState },
    });
    expect(new URLSearchParams(window.location.search).get('place')).toContain('Chợ Bến Thành');
    rerender({ state: { kind: 'none' } });
    expect(window.location.search).toBe('');
    expect(push).not.toHaveBeenCalled();
  });

  it('không gọi replaceState khi URL đã đúng', () => {
    window.history.replaceState(null, '', '/?keep=1');
    const replace = vi.spyOn(window.history, 'replaceState');
    renderHook(() => useAddressBarSync({ kind: 'none' }));
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?keep=1');
  });
});
