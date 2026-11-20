// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferred, routePlan } from '../../../testing/fixtures';
import type { MultiStopPanelProps } from '../types';
import { useMultiStopForm } from './useMultiStopForm';
vi.mock('../../../shared/i18n/I18nProvider', () => ({
  useI18n: () => ({ language: 'vi', t: (s: string) => s }),
}));
afterEach(cleanup);
function setup(overrides: Partial<MultiStopPanelProps> = {}) {
  const props: MultiStopPanelProps = {
    isActive: true,
    isNavigating: false,
    onShowPlan: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
    onStartNavigation: vi.fn(),
    onPlanRoute: vi.fn().mockResolvedValue(routePlan()),
    ...overrides,
  };
  const view = renderHook((p: MultiStopPanelProps) => useMultiStopForm(p), { initialProps: props });
  return { ...view, props };
}
function seed(form: ReturnType<typeof useMultiStopForm>) {
  act(() => {
    form.selectStart(routePlan().stops[0]!);
    form.addStop(routePlan().stops[1]!);
  });
}
describe('multi-stop editor lifecycle', () => {
  it('rejects missing origin without calling the planner', async () => {
    const { result, props } = setup();
    await act(() => result.current.optimize());
    expect(props.onPlanRoute).not.toHaveBeenCalled();
    expect(result.current.error?.source).toContain('xuất phát');
  });
  it('rejects a stop at the start coordinates even when its id differs', () => {
    const { result } = setup();
    act(() => result.current.selectStart(routePlan().stops[0]!));
    act(() => result.current.addStop({ ...routePlan().stops[0]!, id: 'duplicate' }));
    expect(result.current.stops).toEqual([]);
    expect(result.current.error).not.toBeNull();
  });
  it('rejects a start at an existing stop', () => {
    const { result } = setup();
    act(() => result.current.addStop(routePlan().stops[1]!));
    act(() => result.current.selectStart({ ...routePlan().stops[1]!, id: 'duplicate' }));
    expect(result.current.start).toBeNull();
  });
  it('sends preferences and preserves the optimized order', async () => {
    const plan = { ...routePlan(), kind: 'multi' as const };
    const planner = vi.fn().mockResolvedValue(plan);
    const { result } = setup({ onPlanRoute: planner });
    seed(result.current);
    act(() => {
      result.current.setMode('car');
      result.current.setObjective('distance');
    });
    await act(() => result.current.optimize());
    expect(planner).toHaveBeenCalledWith(plan.stops[0], [plan.stops[1]], 'car', 'distance', false);
    expect(result.current.plan).toEqual(plan);
  });
  it('deduplicates two optimization attempts in one event', async () => {
    const task = deferred<ReturnType<typeof routePlan>>();
    const planner = vi.fn(() => task.promise);
    const { result } = setup({ onPlanRoute: planner });
    seed(result.current);
    act(() => {
      void result.current.optimize();
      void result.current.optimize();
    });
    expect(planner).toHaveBeenCalledOnce();
    await act(async () => task.resolve(routePlan()));
  });
  it('does not restore a reset journey when an old request resolves', async () => {
    const task = deferred<ReturnType<typeof routePlan>>();
    const { result } = setup({ onPlanRoute: () => task.promise });
    seed(result.current);
    act(() => {
      void result.current.optimize();
    });
    act(() => result.current.reset());
    await act(async () => task.resolve(routePlan()));
    expect(result.current.plan).toBeNull();
    expect(result.current.start).toBeNull();
    expect(result.current.stops).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
  it('ignores stale results after changing vehicle', async () => {
    const task = deferred<ReturnType<typeof routePlan>>();
    const { result } = setup({ onPlanRoute: () => task.promise });
    seed(result.current);
    act(() => {
      void result.current.optimize();
    });
    act(() => result.current.setMode('car'));
    await act(async () => task.resolve(routePlan()));
    expect(result.current.plan).toBeNull();
  });
  it('keeps the draft while hidden and restores the plan only when active', async () => {
    const { result, rerender, props } = setup({ isActive: false });
    seed(result.current);
    await act(() => result.current.optimize());
    expect(props.onShowPlan).not.toHaveBeenCalled();
    rerender({ ...props, isActive: true });
    expect(props.onShowPlan).toHaveBeenCalledWith(routePlan());
  });
  it('does not publish after unmount', async () => {
    const task = deferred<ReturnType<typeof routePlan>>();
    const { result, unmount, props } = setup({ onPlanRoute: () => task.promise });
    seed(result.current);
    act(() => {
      void result.current.optimize();
    });
    unmount();
    await act(async () => task.resolve(routePlan()));
    expect(props.onShowPlan).not.toHaveBeenCalled();
  });
  it('recovers from planner failure', async () => {
    const { result } = setup({ onPlanRoute: vi.fn().mockRejectedValue(new Error('offline')) });
    seed(result.current);
    await act(() => result.current.optimize());
    expect(result.current.error).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
