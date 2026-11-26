import { describe, expect, it } from 'vitest';
import { resolveMapLayer } from './useMapAppearance';

describe('resolveMapLayer', () => {
  it('follows the system preference in automatic mode', () => {
    expect(resolveMapLayer('auto', false)).toBe('street');
    expect(resolveMapLayer('auto', true)).toBe('dark');
  });

  it('keeps each explicit map choice independent of the interface theme', () => {
    expect(resolveMapLayer('street', true)).toBe('street');
    expect(resolveMapLayer('dark', false)).toBe('dark');
    expect(resolveMapLayer('satellite', true)).toBe('satellite');
  });
});
