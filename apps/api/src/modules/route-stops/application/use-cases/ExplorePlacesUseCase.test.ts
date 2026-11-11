import { describe, expect, it, vi } from 'vitest';
import type { RouteResult } from '@routetwin/shared';
import { ExplorePlacesUseCase } from './ExplorePlacesUseCase.js';
import { FindRouteStopsUseCase } from './FindRouteStopsUseCase.js';
import { KeywordStopIntentParser } from '../../infrastructure/providers/KeywordStopIntentParser.js';
function setup() {
  const parser = new KeywordStopIntentParser();
  const places = {
    search: vi.fn().mockResolvedValue([
      {
        id: 'osm-node-1',
        name: 'School source fixture',
        address: 'Fixture',
        category: 'school',
        lat: 10.701,
        lng: 106.7,
        osmUrl: 'https://www.openstreetmap.org/node/1',
        openingHours: null,
      },
      {
        id: 'osm-node-2',
        name: 'Too far',
        address: 'Fixture',
        category: 'school',
        lat: 11.7,
        lng: 106.7,
        osmUrl: 'https://www.openstreetmap.org/node/2',
        openingHours: null,
      },
    ]),
  };
  const baseline: RouteResult = {
    source: 'vietmap',
    distanceMeters: 1000,
    durationSeconds: 100,
    coordinates: [
      [106.7, 10.7],
      [106.71, 10.7],
    ],
    instructions: [],
  };
  const routes = { calculate: vi.fn().mockResolvedValue(baseline) };
  const find = new FindRouteStopsUseCase(routes, places, parser);
  return { parser, places, routes, usecase: new ExplorePlacesUseCase(parser, places, find) };
}
describe('needs-based location assistant', () => {
  it('asks about ambiguous station without making any upstream request', async () => {
    const { places, routes, usecase } = setup();
    const result = await usecase.execute({
      query: 'Find the station',
      mode: 'nearby',
      vehicle: 'car',
      context: [],
    });
    expect(result).toMatchObject({ status: 'clarify', suggestions: ['fuel', 'bus_stop', 'train_station'] });
    expect(places.search).not.toHaveBeenCalled();
    expect(routes.calculate).not.toHaveBeenCalled();
  });
  it('resolves station with fuel context but lets an explicit new need override context', async () => {
    const { usecase, places } = setup();
    const result = await usecase.execute({
      query: 'Find the station',
      context: ["I'm running low on fuel"],
      mode: 'nearby',
      center: { lat: 10.7, lng: 106.7 },
      vehicle: 'car',
    });
    expect(result).toMatchObject({ status: 'results', category: 'fuel' });
    expect(places.search.mock.calls[0]![0]).toBe('fuel');
    const explicit = await usecase.execute({
      query: 'Find a school',
      context: ["I'm running low on fuel"],
      mode: 'nearby',
      center: { lat: 10.7, lng: 106.7 },
      vehicle: 'car',
    });
    expect(explicit).toMatchObject({ status: 'results', category: 'school' });
  });
  it('does not interpret station as school solely because a school appeared in history', async () => {
    const { usecase } = setup();
    expect(
      await usecase.execute({
        query: 'Find the station',
        context: ['Find a school'],
        mode: 'nearby',
        vehicle: 'car',
      }),
    ).toMatchObject({ status: 'clarify' });
  });
  it('asks for the type of rest rather than inventing a cafe', async () => {
    const { usecase } = setup();
    expect(
      await usecase.execute({ query: 'I need a break', context: [], mode: 'nearby', vehicle: 'car' }),
    ).toMatchObject({ status: 'clarify', suggestions: ['cafe', 'park', 'rest_area'] });
  });
  it('uses true nearby radius, removes off-radius places, without a routing key', async () => {
    const { usecase, routes } = setup();
    const result = await usecase.execute({
      query: 'Find a school within 500 meters',
      context: [],
      mode: 'nearby',
      center: { lat: 10.7, lng: 106.7 },
      vehicle: 'car',
    });
    expect(result).toMatchObject({ status: 'results', mode: 'nearby', radiusMeters: 500 });
    if (result.status !== 'results' || result.mode !== 'nearby') throw new Error('Expected nearby results');
    expect(result.places).toHaveLength(1);
    expect(result.places[0]!.distanceMeters).toBeGreaterThan(100);
    expect(routes.calculate).not.toHaveBeenCalled();
  });
  it('asks for center/route instead of secretly selecting GPS or a fake route', async () => {
    const { usecase } = setup();
    expect(
      await usecase.execute({ query: 'Find a school', context: [], mode: 'nearby', vehicle: 'car' }),
    ).toMatchObject({ status: 'needs_location' });
    expect(
      await usecase.execute({ query: 'Find a gas station', context: [], mode: 'route', vehicle: 'car' }),
    ).toMatchObject({ status: 'needs_route' });
  });
  it('applies chosen category and radius over inferred values', async () => {
    const { usecase } = setup();
    expect(
      await usecase.execute({
        query: 'Find the station',
        context: [],
        mode: 'nearby',
        vehicle: 'car',
        category: 'school',
        radiusMeters: 1000,
        center: { lat: 10.7, lng: 106.7 },
      }),
    ).toMatchObject({ status: 'results', category: 'school', radiusMeters: 1000 });
  });
  it('parses only once when routing an understood need', async () => {
    const { usecase, parser } = setup();
    const parse = vi.spyOn(parser, 'parse');
    await usecase.execute({
      query: 'Find a school',
      context: [],
      mode: 'route',
      vehicle: 'car',
      points: [
        { lat: 10.7, lng: 106.7 },
        { lat: 10.7, lng: 106.71 },
      ],
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
