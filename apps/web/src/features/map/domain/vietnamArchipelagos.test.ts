import { describe, expect, it } from 'vitest';
import { VIETNAM_ARCHIPELAGOS, VIETNAM_ISLANDS, type GeoBounds } from './vietnamArchipelagos';

describe('vietnamArchipelagos', () => {
  it('names both archipelagos as Vietnamese in every language', () => {
    expect(VIETNAM_ARCHIPELAGOS.map((item) => item.name.vi)).toEqual([
      'Quần đảo Hoàng Sa',
      'Quần đảo Trường Sa',
    ]);
    expect(VIETNAM_ARCHIPELAGOS.map((item) => item.name.en)).toEqual([
      'Hoang Sa Archipelago',
      'Truong Sa Archipelago',
    ]);
  });

  it('keeps labels and islands inside their archipelagos', () => {
    const inside = (lat: number, lng: number, b: GeoBounds) =>
      lat > b.south && lat < b.north && lng > b.west && lng < b.east;
    for (const archipelago of VIETNAM_ARCHIPELAGOS)
      expect(inside(...archipelago.label, archipelago.bounds)).toBe(true);
    for (const island of VIETNAM_ISLANDS)
      expect(VIETNAM_ARCHIPELAGOS.some(({ bounds }) => inside(island.lat, island.lng, bounds))).toBe(true);
  });
});
