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

  it('preserves the exact user-selected order for manually planned stop routes', async () => {
    const orderedStops: Place[] = [
      stops[0]!,
      {
        id: 'first-stop',
        name: 'Điểm dừng 1',
        address: '',
        category: '',
        lat: 10.02,
        lng: 106.02,
        source: 'map',
      },
      {
        id: 'second-stop',
        name: 'Điểm dừng 2',
        address: '',
        category: '',
        lat: 10.05,
        lng: 106.05,
        source: 'map',
      },
      stops[1]!,
    ];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            source: 'vietmap',
            distanceMeters: 8000,
            durationSeconds: 1200,
            coordinates: [
              [106, 10],
              [106.1, 10.1],
            ],
            instructions: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const api = new RouteApiClient(new HttpClient({ baseUrl: 'https://api.test', timeoutMs: 1000 }));

    const result = await api.createPlans(orderedStops, 'car', 'time');

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.routes[0]?.stops.map(({ id }) => id)).toEqual(orderedStops.map(({ id }) => id));
    const request = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(request.points).toEqual(orderedStops.map(({ lat, lng }) => ({ lat, lng })));
  });
});

describe('RouteApiClient.createPlan', () => {
  const path = {
    source: 'vietmap',
    distanceMeters: 5000,
    durationSeconds: 600,
    coordinates: [
      [106, 10],
      [106.1, 10.1],
    ],
    instructions: [],
  };
  const respond = () =>
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: path }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  it('gửi yêu cầu tránh phà và ghi tùy chọn vào tuyến trả về', async () => {
    const fetcher = respond();
    vi.stubGlobal('fetch', fetcher);
    const plan = await new RouteApiClient(
      new HttpClient({ baseUrl: 'https://api.test', timeoutMs: 1000 }),
    ).createPlan(stops, 'car', 'distance', true);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toMatchObject({
      avoid: ['ferry'],
      objective: 'distance',
    });
    expect(plan).toMatchObject({ avoidFerry: true, objective: 'distance' });
  });

  it('mặc định không tránh phà và không thêm trường avoidFerry', async () => {
    const fetcher = respond();
    vi.stubGlobal('fetch', fetcher);
    const plan = await new RouteApiClient(
      new HttpClient({ baseUrl: 'https://api.test', timeoutMs: 1000 }),
    ).createPlan(stops, 'car');
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).not.toHaveProperty('avoid');
    expect(plan).not.toHaveProperty('avoidFerry');
  });
});
