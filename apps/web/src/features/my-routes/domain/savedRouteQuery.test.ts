import { describe, expect, it } from 'vitest';
import type { Place } from '../../places/types';
import type { SavedRoute } from '../types';
import { savedRouteDirectionsQuery, savedRouteStops } from './savedRouteQuery';

const place = (id: string): Place => ({ id, name: id, lat: 10, lng: 106 }) as Place;
const [A, V, B] = [place('A'), place('V'), place('B')];

const saved = (overrides: Partial<SavedRoute> = {}): SavedRoute => ({
  id: '1',
  kind: 'route',
  title: 'A → B',
  origin: A,
  destination: B,
  stops: [A, V, B],
  vehicle: 'car',
  originId: 'A',
  originName: 'A',
  destinationId: 'B',
  destinationName: 'B',
  ...overrides,
});

describe('savedRouteDirectionsQuery', () => {
  it('giữ tiêu chí "ngắn nhất", "tránh phà" và điểm ghé như lúc lưu', () => {
    expect(savedRouteDirectionsQuery(saved({ objective: 'distance', avoidFerry: true }))).toEqual({
      origin: A,
      destination: B,
      via: [V],
      vehicle: 'car',
      objective: 'distance',
      avoidFerry: true,
    });
  });

  it('dữ liệu cũ chưa có tiêu chí thì dùng mặc định "nhanh nhất", không tránh phà', () => {
    const query = savedRouteDirectionsQuery(saved({ stops: undefined }));
    expect(query).toMatchObject({ via: [], objective: 'time', avoidFerry: false });
  });

  it('thiếu điểm đến thì không mở lại được', () => {
    expect(savedRouteStops(saved({ stops: undefined, destination: undefined }))).toEqual([]);
    expect(savedRouteDirectionsQuery(saved({ stops: undefined, destination: undefined }))).toBeNull();
  });
});
