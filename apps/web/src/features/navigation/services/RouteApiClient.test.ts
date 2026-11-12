import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../../../shared/api/HttpClient';
import type { Place } from '../../places/types';
import { RouteApiClient } from './RouteApiClient';

afterEach(() => vi.unstubAllGlobals());

const stops: Place[] = [
  { id: 'start', name: 'Điểm A', address: '', category: '', lat: 10, lng: 106, source: 'map' },
  { id: 'end', name: 'Điểm B', address: '', category: '', lat: 10.1, lng: 106.1, source: 'map' },
];

describe('RouteApiClient alternatives', () => {
  it('requests alternatives for the chosen vehicle and ferry preference', async () => {
    const responsePath = {
      source: 'vietmap',
      distanceMeters: 5000,
      durationSeconds: 600,
      coordinates: [
        [106, 10],
        [106.1, 10.1],
      ],
      instructions: [],
      tollCostVnd: 44000,
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...responsePath,
            alternatives: [{ ...responsePath, durationSeconds: 780, variant: 'avoid-toll', tollCostVnd: 0 }],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const api = new RouteApiClient(new HttpClient({ baseUrl: 'https://api.test', timeoutMs: 1000 }));

    const result = await api.createPlans(stops, 'car', 'time', true);

    expect(result).toMatchObject({
      routes: [
        { vehicle: 'car', durationMin: 10, tollCostVnd: 44000 },
        { vehicle: 'car', durationMin: 13, variant: 'avoid-toll', tollCostVnd: 0 },
      ],
    });
    const request = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(request).toMatchObject({
      vehicle: 'car',
      objective: 'duration',
      alternatives: true,
      avoid: ['ferry'],
    });
  });
});
