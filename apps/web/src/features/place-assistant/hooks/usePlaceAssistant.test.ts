// @vitest-environment jsdom
import type { ExplorePlacesResponse } from '@routetwin/shared';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, routePlan } from '../../../testing/fixtures';
import { assistantApi } from '../api/assistantApi';
import type { PlaceAssistantPanelProps } from '../types';
import { usePlaceAssistant } from './usePlaceAssistant';
vi.mock('../api/assistantApi', () => ({
  assistantApi: { routeStopsConfig: vi.fn(), explorePlaces: vi.fn() },
}));
vi.mock('../../../shared/i18n/I18nProvider', () => ({
  useI18n: () => ({ language: 'vi', t: (s: string) => s }),
}));
beforeEach(() => {
  vi.mocked(assistantApi.routeStopsConfig).mockReset().mockResolvedValue({ aiConfigured: true });
  vi.mocked(assistantApi.explorePlaces).mockReset();
});
afterEach(cleanup);
function setup(overrides: Partial<PlaceAssistantPanelProps> = {}) {
  const props: PlaceAssistantPanelProps = {
    accessToken: 'first',
    route: null,
    selectedPoint: { lat: 10, lng: 106 },
    getMapCenter: () => ({ lat: 11, lng: 107 }),
    onClose: vi.fn(),
    onFocus: vi.fn(),
    onDirections: vi.fn(),
    onAddStop: vi.fn(),
    onRemoveStop: vi.fn(),
    ...overrides,
  };
  return {
    ...renderHook((p: PlaceAssistantPanelProps) => usePlaceAssistant(p), { initialProps: props }),
    props,
  };
}
const response: ExplorePlacesResponse = {
  status: 'needs_location',
  source: 'rules',
  message: 'Choose a point',
};
describe('assistant search ownership', () => {
  it('validates category before issuing a request', async () => {
    const { result } = setup();
    await act(() => result.current.submit());
    expect(assistantApi.explorePlaces).not.toHaveBeenCalled();
    expect(result.current.error).not.toBe('');
  });
  it('sends nearby radius in metres and uses the authenticated token', async () => {
    vi.mocked(assistantApi.explorePlaces).mockResolvedValue(response);
    const { result } = setup();
    act(() => result.current.setRadius('1.5'));
    await act(() => result.current.submit('fuel'));
    expect(assistantApi.explorePlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'nearby',
        center: { lat: 10, lng: 106 },
        radiusMeters: 1500,
        category: 'fuel',
      }),
      expect.any(AbortSignal),
      'first',
    );
    expect(result.current.loading).toBe(false);
  });
  it('sends the two route points and detour units', async () => {
    vi.mocked(assistantApi.explorePlaces).mockResolvedValue(response);
    const { result } = setup({ route: routePlan() });
    act(() => {
      result.current.setDistance('0.5');
      result.current.setMinutes('3');
    });
    await act(() => result.current.submit('fuel'));
    expect(assistantApi.explorePlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'route',
        points: routePlan().stops.map(({ lat, lng }) => ({ lat, lng })),
        maxExtraDistanceMeters: 500,
        maxExtraDurationSeconds: 180,
      }),
      expect.any(AbortSignal),
      'first',
    );
  });
  it.each(['cancel', 'token', 'point', 'route', 'unmount'] as const)(
    'discards a response after %s changes',
    async (change) => {
      const task = deferred<ExplorePlacesResponse>();
      vi.mocked(assistantApi.explorePlaces).mockReturnValue(task.promise);
      const view = setup();
      act(() => {
        void view.result.current.submit('fuel');
      });
      const signal = vi.mocked(assistantApi.explorePlaces).mock.calls[0]![1];
      if (change === 'cancel') act(() => view.result.current.cancelSearch());
      if (change === 'token') view.rerender({ ...view.props, accessToken: 'second' });
      if (change === 'point') view.rerender({ ...view.props, selectedPoint: { lat: 12, lng: 108 } });
      if (change === 'route') view.rerender({ ...view.props, route: routePlan('new') });
      if (change === 'unmount') view.unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => task.resolve(response));
      expect(view.result.current.result).toBeNull();
    },
  );
  it('lets the latest search win even when the first request ignores abort', async () => {
    const first = deferred<ExplorePlacesResponse>(),
      second = deferred<ExplorePlacesResponse>();
    vi.mocked(assistantApi.explorePlaces)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = setup();
    act(() => {
      void result.current.submit('fuel');
    });
    act(() => {
      void result.current.submit('cafe');
    });
    await act(async () => second.resolve(response));
    await act(async () => first.resolve({ ...response, message: 'stale' }));
    expect(result.current.result).toEqual(response);
  });
  it('keeps at most four context entries', async () => {
    vi.mocked(assistantApi.explorePlaces).mockResolvedValue(response);
    const { result } = setup();
    act(() => result.current.setInputMode('text'));
    for (let i = 0; i < 6; i++) {
      act(() => result.current.setQuery('cafe ' + i));
      await act(() => result.current.submit());
    }
    expect(result.current.context).toEqual(['cafe 2', 'cafe 3', 'cafe 4', 'cafe 5']);
  });
});
