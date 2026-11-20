import { describe, expect, it } from 'vitest';
import type { Place } from '../types';
import {
  isRecordablePlace,
  MAX_RECENT_PLACES,
  mergeRemoteRecentPlaces,
  pushRecentPlace,
  recentPlaceKey,
  type RecentPlaces,
} from './recentPlaces';

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

  it('server list arriving late keeps a place recorded meanwhile (review #7)', () => {
    const remote: RecentPlaces = { origin: [place(1), place(2)], destination: [] };
    const merged = mergeRemoteRecentPlaces(remote, [{ type: 'record', kind: 'origin', place: place(9) }]);
    expect(merged.origin.map((item) => item.name)).toEqual(['Điểm 9', 'Điểm 1', 'Điểm 2']);
  });

  it('server list arriving late does not bring back a place removed meanwhile', () => {
    const remote: RecentPlaces = { origin: [], destination: [place(1), place(2)] };
    const merged = mergeRemoteRecentPlaces(remote, [
      { type: 'remove', kind: 'destination', key: recentPlaceKey(place(1)) },
    ]);
    expect(merged.destination.map((item) => item.name)).toEqual(['Điểm 2']);
  });

  it('replays edits in order and leaves the server list untouched when there are none', () => {
    const remote: RecentPlaces = { origin: [place(1)], destination: [] };
    expect(mergeRemoteRecentPlaces(remote, [])).toBe(remote);
    const merged = mergeRemoteRecentPlaces(remote, [
      { type: 'record', kind: 'origin', place: place(3) },
      { type: 'remove', kind: 'origin', key: recentPlaceKey(place(3)) },
    ]);
    expect(merged.origin.map((item) => item.name)).toEqual(['Điểm 1']);
  });
});
