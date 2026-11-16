import { describe, expect, it } from 'vitest';
import type { Place } from '../types';
import { isRecordablePlace, MAX_RECENT_PLACES, pushRecentPlace } from './recentPlaces';

const place = (index: number): Place => ({
  id: `p${index}`,
  name: `Điểm ${index}`,
  address: '',
  category: '',
  lat: 10 + index / 100,
  lng: 106,
  source: 'vietmap',
});

describe('recent places', () => {
  it('keeps the 10 most recent places, newest first, without duplicates', () => {
    let list: Place[] = [];
    for (let index = 0; index < 12; index++) list = pushRecentPlace(list, place(index));
    list = pushRecentPlace(list, { ...place(5), id: 'other-id' });
    expect(list).toHaveLength(MAX_RECENT_PLACES);
    expect(list[0]!.name).toBe('Điểm 5');
    expect(list.filter((item) => item.name === 'Điểm 5')).toHaveLength(1);
  });

  it('does not record the current GPS position', () => {
    expect(isRecordablePlace({ ...place(1), source: 'gps' })).toBe(false);
    expect(isRecordablePlace(place(1))).toBe(true);
  });
});
