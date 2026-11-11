import { describe, expect, it, vi } from 'vitest';
import type { RouteResult, StopPlace, RouteStopRequest } from '@routetwin/shared';
import { FindRouteStopsUseCase } from './FindRouteStopsUseCase.js';
import { KeywordStopIntentParser } from '../../infrastructure/providers/KeywordStopIntentParser.js';
import { AppError } from '../../../../shared/errors/AppError.js';
const base: RouteResult = {
  source: 'vietmap',
  distanceMeters: 10000,
  durationSeconds: 1000,
  coordinates: [
    [106.7, 10.7],
    [106.8, 10.7],
  ],
  instructions: [],
};
const request: RouteStopRequest = {
  points: [
    { lng: 106.7, lat: 10.7 },
    { lng: 106.8, lat: 10.7 },
  ],
  vehicle: 'motorcycle',
  query: 'Tìm trạm xăng, thêm tối đa 1 km',
};
function place(id: string, lat = 10.701, lng = 106.75): StopPlace {
  return {
    id,
    name: id,
    address: 'OSM address',
    lat,
    lng,
    category: 'fuel',
    osmUrl: 'https://www.openstreetmap.org/node/1',
    openingHours: null,
  };
}
function setup(places: StopPlace[] = [place('near'), place('far', 10.702)]) {
  const calculate = vi.fn().mockResolvedValue(base);
  const search = vi.fn().mockResolvedValue(places);
  const usecase = new FindRouteStopsUseCase({ calculate }, { search }, new KeywordStopIntentParser());
  return { calculate, search, usecase };
}
describe('find verified stops along a route', () => {
  it('uses actual routing deltas and rejects a near-line POI requiring a long road detour', async () => {
    const { calculate, usecase } = setup();
    calculate
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base, distanceMeters: 11500 })
      .mockResolvedValueOnce({ ...base, distanceMeters: 10700, durationSeconds: 1180 });
    const result = await usecase.execute(request);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      place: { id: 'far' },
      extraDistanceMeters: 700,
      extraDurationSeconds: 180,
    });
    expect(calculate.mock.calls[1]![0]).toEqual({
      points: [request.points[0], { lat: 10.701, lng: 106.75 }, request.points[1]],
      vehicle: 'motorcycle',
      objective: 'duration',
    });
  });
  it('enforces raw limits before rounding displayed distances and minutes', async () => {
    const { calculate, usecase } = setup([place('one')]);
    calculate.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, distanceMeters: 11000.01 });
    expect((await usecase.execute(request)).candidates).toHaveLength(0);
  });
  it('explicit filters override interpretation, including zero extra time', async () => {
    const { calculate, search, usecase } = setup([place('one')]);
    calculate.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, durationSeconds: 1001 });
    const result = await usecase.execute({ ...request, category: 'cafe', maxExtraDurationSeconds: 0 });
    expect(search.mock.calls[0]![0]).toBe('cafe');
    expect(result.candidates).toHaveLength(0);
    expect(result.interpretation.maxExtraDurationSeconds).toBe(0);
  });
  it('deduplicates, removes off-corridor POIs, caps routing at four and output at three', async () => {
    const { calculate, usecase } = setup([
      place('duplicate'),
      place('duplicate'),
      place('off', 11),
      ...Array.from({ length: 8 }, (_, i) => place(`p${i}`)),
    ]);
    const result = await usecase.execute(request);
    expect(calculate).toHaveBeenCalledTimes(5);
    expect(result.checkedCandidates).toBe(4);
    expect(result.candidates).toHaveLength(3);
  });
  it('ranks by additional driving time, then distance', async () => {
    const { calculate, usecase } = setup();
    calculate
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base, durationSeconds: 1200, distanceMeters: 10100 })
      .mockResolvedValueOnce({ ...base, durationSeconds: 1100, distanceMeters: 10900 });
    expect((await usecase.execute(request)).candidates.map((item) => item.place.id)).toEqual(['far', 'near']);
  });
  it('preserves partial success with a visible warning', async () => {
    const { calculate, usecase } = setup();
    calculate
      .mockResolvedValueOnce(base)
      .mockRejectedValueOnce(new AppError(422, 'ROUTE_NOT_FOUND', 'Unreachable'))
      .mockResolvedValueOnce(base);
    const result = await usecase.execute(request);
    expect(result.candidates).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('1 địa điểm');
  });
  it('distinguishes provider failure from a genuine empty result', async () => {
    const { calculate, usecase } = setup([place('one')]);
    calculate.mockResolvedValueOnce(base).mockRejectedValueOnce(new Error('network'));
    await expect(usecase.execute(request)).rejects.toMatchObject({ code: 'STOP_ROUTES_UNAVAILABLE' });
    expect((await setup([]).usecase.execute(request)).candidates).toEqual([]);
  });
  it('propagates quota/key errors rather than showing no matching places', async () => {
    const { calculate, usecase } = setup([place('one')]);
    calculate
      .mockResolvedValueOnce(base)
      .mockRejectedValueOnce(new AppError(503, 'ROUTE_PROVIDER_QUOTA', 'quota'));
    await expect(usecase.execute(request)).rejects.toMatchObject({ code: 'ROUTE_PROVIDER_QUOTA' });
  });
  it('rejects ambiguous intent and long routes before querying public OSM', async () => {
    const { calculate, search, usecase } = setup();
    await expect(usecase.execute({ ...request, query: 'Tìm gì đó' })).rejects.toMatchObject({
      code: 'STOP_CATEGORY_UNCLEAR',
    });
    expect(calculate).not.toHaveBeenCalled();
    calculate.mockResolvedValue({ ...base, distanceMeters: 80001 });
    await expect(usecase.execute(request)).rejects.toMatchObject({ code: 'STOP_ROUTE_LIMIT' });
    expect(search).not.toHaveBeenCalled();
  });
});
