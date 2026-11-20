import { describe, expect, it } from 'vitest';
import type { RouteInstruction } from '@routetwin/shared';
import { formatInstructionText } from './maneuver';

const instruction = (sign: number, streetName = ''): RouteInstruction => ({
  text: 'VietMap instruction',
  sign,
  streetName,
  distanceMeters: 120,
  durationSeconds: 12,
});

describe('formatInstructionText', () => {
  it('uses the original localized instruction in Vietnamese', () => {
    expect(formatInstructionText({ ...instruction(2), text: 'Rẽ phải' }, 'vi')).toBe('Rẽ phải');
  });

  it('uses the maneuver code and preserves the road name in English', () => {
    expect(formatInstructionText(instruction(2, 'Nguyễn Huệ'), 'en')).toBe('Turn right onto Nguyễn Huệ');
    expect(formatInstructionText(instruction(0), 'en')).toBe('Continue straight');
  });

  it('handles arrival instructions in English', () => {
    expect(formatInstructionText(instruction(4), 'en')).toBe('You have arrived');
  });

  it('uses a readable fallback for unknown Vietnamese instructions', () => {
    expect(formatInstructionText(instruction(42, 'Đường số 1'), 'en')).toBe('Continue on Đường số 1');
  });
});
