import type { RouteResult } from '@routetwin/shared';
import type { RoutePlan } from '../features/routing/types';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export function routePlan(id = 'route-a'): RoutePlan {
  const origin = { id: 'a', name: 'A', address: '', category: '', lat: 10, lng: 106, source: 'map' as const };
  const destination = { ...origin, id: 'b', name: 'B', lat: 10.01, lng: 106.01 };
  return {
    id,
    kind: 'route',
    stops: [origin, destination],
    vehicle: 'car',
    objective: 'time',
    distanceKm: 2,
    durationMin: 5,
    legs: [
      {
        nodes: ['a', 'b'],
        points: [
          [10, 106],
          [10.01, 106.01],
        ],
        distanceKm: 2,
        durationMin: 5,
        from: origin,
        to: destination,
      },
    ],
  };
}

export function routeResult(): RouteResult {
  return {
    source: 'vietmap',
    distanceMeters: 2_000,
    durationSeconds: 300,
    coordinates: [
      [106, 10],
      [106.01, 10.01],
    ],
    instructions: [],
  };
}
