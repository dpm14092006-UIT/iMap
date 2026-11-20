import { describe, expect, it } from 'vitest';
import type { RoutePlan } from '../../map/types';
import type { Place } from '../../places/types';
import { savedRouteDirectionsQuery } from './savedRouteQuery';
import { toSavedRoute } from './toSavedRoute';

const place = (id: string, lat: number): Place => ({ id, name: id, lat, lng: 106.7 }) as Place;
const [A, V, B] = [place('A', 10.77), place('V', 10.78), place('B', 10.79)];

/** Tuyến chỉ đường có một điểm ghé: routePlanFromResult gán kind 'multi' vì có hơn 2 điểm. */
const directionsPlanWithVia = {
  id: 'r',
  kind: 'multi',
  stops: [A, V, B],
  legs: [],
  distanceKm: 3,
  durationMin: 10,
  vehicle: 'car',
  objective: 'distance',
} as unknown as RoutePlan;

describe('toSavedRoute', () => {
  it('tuyến chỉ đường có điểm ghé mở lại vẫn giữ "tránh phà" (review PR #11)', () => {
    const saved = toSavedRoute(directionsPlanWithVia, { avoidFerry: true, panel: 'directions' });
    expect(saved.kind).toBe('route');
    expect(savedRouteDirectionsQuery(saved)).toMatchObject({
      via: [V],
      objective: 'distance',
      avoidFerry: true,
    });
  });

  it('hành trình từ panel Nhiều điểm vẫn là "multi"', () => {
    expect(toSavedRoute(directionsPlanWithVia).kind).toBe('multi');
  });
});
