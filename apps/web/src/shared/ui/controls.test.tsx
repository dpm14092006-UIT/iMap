// @vitest-environment jsdom
import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Input, Select, Textarea } from './Input';
afterEach(cleanup);
describe('shared native controls', () => {
  it('does not submit its enclosing form by default', () => {
    const submit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button>Save</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(submit).not.toHaveBeenCalled();
  });
  it('supports explicit submit and preserves its event', () => {
    const submit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button type="submit">Save</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(submit).toHaveBeenCalledOnce();
  });
  it('blocks repeated actions while loading and exposes aria-busy', () => {
    const click = vi.fn();
    render(
      <Button loading onClick={click}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button') as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(click).not.toHaveBeenCalled();
  });
  it('forwards focus refs and accessible names', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Origin" />);
    ref.current?.focus();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Origin' }));
  });
  it('preserves validation attributes and change handlers', () => {
    const change = vi.fn();
    render(<Input aria-label="Radius" type="number" min={0.1} max={5} required onChange={change} />);
    const field = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '6' } });
    expect(field.validity.rangeOverflow).toBe(true);
    expect(change).toHaveBeenCalledOnce();
  });
  it('preserves native select and textarea behavior', () => {
    render(
      <>
        <Select aria-label="Vehicle" defaultValue="car">
          <option value="car">Car</option>
          <option value="motorcycle">Motorcycle</option>
        </Select>
        <Textarea aria-label="Note" maxLength={300} />
      </>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'motorcycle' } });
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('motorcycle');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).maxLength).toBe(300);
  });
});
