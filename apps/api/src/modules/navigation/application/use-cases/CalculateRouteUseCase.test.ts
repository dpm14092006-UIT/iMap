import type { RoutePathResult, RouteRequest } from '@routetwin/shared';
import { describe, expect, it, vi } from 'vitest';
import type { RouteProvider } from '../../domain/ports/RouteProvider.js';
import { CalculateRouteUseCase } from './CalculateRouteUseCase.js';

/** Đường thẳng dọc kinh tuyến; `offset` (độ kinh) dịch ngang để tạo tuyến khác hẳn. */
const path = (distanceKm: number, minutes: number, offset = 0): RoutePathResult => ({
  source: 'vietmap',
  distanceMeters: distanceKm * 1000,
  durationSeconds: minutes * 60,
  coordinates: Array.from({ length: 50 }, (_, i): [number, number] => [106.7 + offset, 10.3 + i * 0.01]),
  instructions: [],
});

const request: RouteRequest = {
  points: [
    { lat: 10.772, lng: 106.698 },
    { lat: 10.346, lng: 107.084 },
  ],
  vehicle: 'car',
  objective: 'duration',
  alternatives: true,
};

function providerBy(byAvoid: Record<string, RoutePathResult[] | Error>) {
  return {
    calculate: vi.fn(async (input: RouteRequest) => {
      const outcome = byAvoid[(input.avoid ?? []).join(',')];
      if (!outcome) throw new Error('unexpected');
      if (outcome instanceof Error) throw outcome;
      const [primary, ...alternatives] = outcome;
      return { ...primary!, ...(alternatives.length ? { alternatives } : {}) };
    }),
  } satisfies RouteProvider;
}

describe('CalculateRouteUseCase', () => {
  it('chỉ gọi nhà cung cấp một lần khi không cần phương án thay thế', async () => {
    const provider = providerBy({ '': [path(98, 85)] });
    const result = await new CalculateRouteUseCase(provider).execute({ ...request, alternatives: false });
    expect(provider.calculate).toHaveBeenCalledTimes(1);
    expect(result.variant).toBeUndefined();
  });

  it('gọi song song bản gốc cùng tránh trạm thu phí, cao tốc, phà và gắn nhãn biến thể', async () => {
    const provider = providerBy({
      '': [path(97.9, 85)],
      toll: [path(113.9, 108, 0.1), path(118.9, 115, 0.2)],
      motorway: [path(113.1, 123, 0.3)],
      ferry: [path(97.9, 85), path(101.5, 90, 0.4)],
    });
    const result = await new CalculateRouteUseCase(provider).execute(request);
    expect(provider.calculate.mock.calls.map(([input]) => input.avoid ?? [])).toEqual([
      [],
      ['toll'],
      ['motorway'],
      ['ferry'],
    ]);
    const all = [result, ...(result.alternatives ?? [])];
    expect(all).toHaveLength(4); // tối đa 4, bản trùng của default bị gộp
    expect(all.map((item) => item.durationSeconds)).toEqual([...all.map((i) => i.durationSeconds)].sort((a, b) => a - b));
    expect(result).toMatchObject({ distanceMeters: 97_900, variant: 'default' });
    expect(all.map((item) => item.variant)).toEqual(['default', 'avoid-ferry', 'avoid-toll', 'avoid-toll']);
  });

  it('không lặp lại tùy chọn người dùng đã chọn và giữ nó trong các lời gọi phụ', async () => {
    const provider = providerBy({
      ferry: [path(98, 85)],
      'ferry,toll': [path(114, 108, 0.1)],
      'ferry,motorway': [path(113, 123, 0.3)],
    });
    await new CalculateRouteUseCase(provider).execute({ ...request, avoid: ['ferry'] });
    expect(provider.calculate.mock.calls.map(([input]) => input.avoid)).toEqual([
      ['ferry'],
      ['ferry', 'toll'],
      ['ferry', 'motorway'],
    ]);
  });

  it('bỏ qua lời gọi phụ bị lỗi', async () => {
    const provider = providerBy({
      '': [path(98, 85)],
      toll: new Error('boom'),
      motorway: [path(113, 123, 0.3)],
      ferry: new Error('timeout'),
    });
    const result = await new CalculateRouteUseCase(provider).execute(request);
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives![0]).toMatchObject({ variant: 'avoid-motorway' });
  });

  it('báo lỗi khi lời gọi chính thất bại', async () => {
    const provider = providerBy({
      '': new Error('main failed'),
      toll: [path(113, 108, 0.1)],
      motorway: [path(113, 123, 0.3)],
      ferry: [path(113, 123, 0.3)],
    });
    await expect(new CalculateRouteUseCase(provider).execute(request)).rejects.toThrow('main failed');
  });

  it('chỉ gộp khi khoảng cách, thời gian và hình học đều gần như trùng', async () => {
    const provider = providerBy({
      '': [path(100, 90)],
      toll: [path(100.5, 90.5)], // trùng hình học, lệch <1% / <2%
      motorway: [path(100.5, 90.5, 0.05)], // khác hình học (~5 km)
      ferry: [path(104, 90)], // lệch khoảng cách >1%
    });
    const result = await new CalculateRouteUseCase(provider).execute(request);
    expect(result.alternatives?.map((item) => item.variant)).toEqual(['avoid-ferry', 'avoid-motorway']);
  });
});
