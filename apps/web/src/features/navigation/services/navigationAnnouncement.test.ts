import { describe, expect, it } from 'vitest';
import { navigationAnnouncement, spokenDistance } from './navigationAnnouncement';

const guidance = {
  status: 'navigating' as const,
  offRoute: false,
  instruction: { text: 'Rẽ phải', sign: 2 },
  distanceMeters: 500,
  language: 'vi' as const,
};
describe('spoken navigation prompts', () => {
  it('uses distinct advance, approach and turn phases', () => {
    expect(navigationAnnouncement(guidance)).toMatchObject({ phase: 0, text: 'Sau 500 mét, Rẽ phải' });
    expect(navigationAnnouncement({ ...guidance, distanceMeters: 180 })).toMatchObject({ phase: 1 });
    expect(navigationAnnouncement({ ...guidance, distanceMeters: 30 })).toMatchObject({
      phase: 2,
      text: 'Rẽ phải',
    });
  });
  it('does not speak before GPS starts or for absent/invalid instructions', () => {
    expect(navigationAnnouncement({ ...guidance, status: 'idle' })).toBeNull();
    expect(navigationAnnouncement({ ...guidance, status: 'locating' })).toBeNull();
    expect(navigationAnnouncement({ ...guidance, instruction: null })).toBeNull();
    expect(navigationAnnouncement({ ...guidance, distanceMeters: NaN })).toBeNull();
  });
  it('prioritizes arrival, loss of GPS, and leaving the route', () => {
    expect(navigationAnnouncement({ ...guidance, status: 'arrived' })).toMatchObject({
      status: 'arrived',
      priority: true,
    });
    expect(navigationAnnouncement({ ...guidance, status: 'error' })).toMatchObject({
      status: 'error',
      priority: true,
    });
    expect(navigationAnnouncement({ ...guidance, offRoute: true })).toMatchObject({
      status: 'off-route',
      priority: true,
    });
  });
  it('uses spoken distance units and translates English instructions', () => {
    expect(spokenDistance(1500, 'en')).toBe('1.5 kilometers');
    expect(spokenDistance(121, 'vi')).toBe('120 mét');
    expect(navigationAnnouncement({ ...guidance, language: 'en' })).toMatchObject({
      text: 'In 500 meters, Turn right',
    });
  });
});
