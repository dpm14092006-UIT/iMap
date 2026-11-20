// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, routePlan } from '../../../testing/fixtures';
import { placeApi } from '../api/placeApi';
import type { Place, PlaceComboboxProps } from '../types';
import { PlaceCombobox } from './PlaceCombobox';
vi.mock('../hooks/usePlaceSearch', () => ({
  MIN_QUERY_LENGTH: 2,
  usePlaceSearch: () => ({ results: [], status: 'ready', error: '' }),
}));
vi.mock('../api/placeApi', () => ({ placeApi: { resolve: vi.fn() } }));
vi.mock('../../../shared/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (s: string, values?: Record<string, string | number>) =>
      s.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? '{' + key + '}')),
  }),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.mocked(placeApi.resolve)
    .mockReset()
    .mockImplementation(async (suggestion) => suggestion as Place);
});
const places = routePlan().stops.map((place, i) => ({ ...place, name: `Cafe ${i + 1}` }));
function setup(extra: Partial<PlaceComboboxProps> = {}) {
  const select = vi.fn(),
    remove = vi.fn();
  function Form() {
    const [value, setValue] = useState('Cafe');
    return (
      <>
        <PlaceCombobox
          value={value}
          onChange={setValue}
          onSelect={select}
          places={places}
          placeholder="Search"
          ariaLabel="Place"
          onRemoveRecent={remove}
          {...extra}
        />
        <button>Outside</button>
      </>
    );
  }
  render(<Form />);
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  return { input, select, remove };
}
describe('split combobox interactions', () => {
  it('connects the input to visible options and resolves keyboard selection', async () => {
    const { input, select } = setup();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const id = input.getAttribute('aria-controls');
    expect(screen.getByRole('listbox').id).toBe(id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(`${id}-1`);
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }));
    expect(select).toHaveBeenCalledWith(places[1]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
  it('wraps ArrowUp to the final option', () => {
    const { input } = setup();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[1]?.getAttribute('aria-selected')).toBe('true');
  });
  it('consumes Escape while the popup is open', () => {
    const { input } = setup();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(input, event);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('shows a failed details request without selecting a place', async () => {
    vi.mocked(placeApi.resolve).mockRejectedValue(new Error('No coordinates'));
    const { input, select } = setup();
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }));
    expect(screen.getByRole('alert').textContent).toBe('No coordinates');
    expect(select).not.toHaveBeenCalled();
  });
  it.each(['typing', 'blur', 'escape', 'unmount'] as const)(
    'aborts stale selection on %s',
    async (change) => {
      const task = deferred<Place>();
      vi.mocked(placeApi.resolve).mockReturnValue(task.promise);
      const { input, select } = setup();
      fireEvent.keyDown(input, { key: 'Enter' });
      const signal = vi.mocked(placeApi.resolve).mock.calls[0]![1]!;
      if (change === 'typing') fireEvent.change(input, { target: { value: 'New query' } });
      if (change === 'blur')
        fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
      if (change === 'escape') fireEvent.keyDown(input, { key: 'Escape' });
      if (change === 'unmount') cleanup();
      expect(signal.aborted).toBe(true);
      await act(async () => task.resolve(places[0]!));
      expect(select).not.toHaveBeenCalled();
    },
  );
  it('runs a preferred category action instead of resolving an address', () => {
    const run = vi.fn();
    const { input } = setup({ action: { label: 'Find cafes', icon: 'search', preferred: true, onRun: run } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(run).toHaveBeenCalledOnce();
    expect(placeApi.resolve).not.toHaveBeenCalled();
  });
  it('removes a recent place without selecting it', () => {
    const { remove, select } = setup({ value: '', recentActive: true, recentPlaces: places });
    fireEvent.click(screen.getByRole('button', { name: /Xóa Cafe 1/ }));
    expect(remove).toHaveBeenCalledWith(places[0]);
    expect(select).not.toHaveBeenCalled();
  });
});
