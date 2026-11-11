import type { RouteRequest, RouteResult } from '@routetwin/shared';
import { describe, expect, it, vi } from 'vitest';
import { RerouteUseCase } from './RerouteUseCase.js';

/** Tuyến giả: đi qua các tọa độ [lng, lat] cho trước. */
const route = (coordinates: [number, number][], durationSeconds: number): RouteResult => ({
  source: 'vietmap',
  distanceMeters: durationSeconds * 10,
  durationSeconds,
  coordinates,
  instructions: [],
});

// Tuyến thẳng Bắc–Nam qua kinh độ 106.700 và tuyến vòng qua kinh độ 106.705 (lệch ~550 m).
const straight = route(
  [
    [106.7, 10.77],
    [106.7, 10.78],
  ],
  300,
);
const eastern = route(
  [
    [106.7, 10.77],
    [106.705, 10.775],
    [106.7, 10.78],
  ],
  420,
);
const incidentOnStraight = { lat: 10.775, lng: 106.7, radiusMeters: 60 };
const input = {
  from: { lat: 10.77, lng: 106.7 },
  stops: [{ lat: 10.78, lng: 106.7 }],
  vehicle: 'motorcycle' as const,
  objective: 'duration' as const,
};

function providerReturning(...responses: RouteResult[][]) {
  const calculateAlternatives = vi.fn<(request: RouteRequest) => Promise<RouteResult[]>>();
  responses.forEach((response) => calculateAlternatives.mockResolvedValueOnce(response));
  return { calculateAlternatives };
}

describe('RerouteUseCase', () => {
  it('direct: không có sự cố thì dùng tuyến tốt nhất', async () => {
    const result = await new RerouteUseCase(providerReturning([straight, eastern])).execute({
      ...input,
      avoid: [],
    });
    expect(result).toMatchObject({ route: straight, strategy: 'direct', blockedCount: 0 });
  });

  it('alternative: tuyến tốt nhất đi qua sự cố thì chọn tuyến thay thế của VietMap', async () => {
    const result = await new RerouteUseCase(providerReturning([straight, eastern])).execute({
      ...input,
      avoid: [incidentOnStraight],
    });
    expect(result).toMatchObject({
      route: eastern,
      strategy: 'alternative',
      blockedCount: 0,
      candidatesChecked: 2,
    });
  });

  it('detour: mọi tuyến bị chặn thì đi vòng qua điểm cạnh sự cố, điểm vòng nằm giữa vị trí hiện tại và đích', async () => {
    const provider = providerReturning([straight], [straight], [eastern]);
    const result = await new RerouteUseCase(provider).execute({ ...input, avoid: [incidentOnStraight] });
    expect(result.strategy).toBe('detour');
    expect(result.route).toBe(eastern);
    const detourRequest = provider.calculateAlternatives.mock.calls[1]![0];
    expect(detourRequest.points).toHaveLength(3); // từ → điểm vòng → đích
    expect(detourRequest.points[2]).toEqual(input.stops[0]);
  });

  it('unavoidable: không tránh được thì trả tuyến tốt nhất và báo số sự cố còn trên đường', async () => {
    const result = await new RerouteUseCase(providerReturning([straight], [straight], [straight])).execute({
      ...input,
      avoid: [incidentOnStraight],
    });
    expect(result).toMatchObject({
      route: straight,
      strategy: 'unavoidable',
      blockedCount: 1,
      candidatesChecked: 3,
    });
  });

  it('bỏ qua điểm vòng không tính được tuyến (rơi xuống sông) và thử điểm còn lại', async () => {
    const calculateAlternatives = vi
      .fn()
      .mockResolvedValueOnce([straight])
      .mockRejectedValueOnce(new Error('ZERO_RESULTS'))
      .mockResolvedValueOnce([eastern]);
    const result = await new RerouteUseCase({ calculateAlternatives }).execute({
      ...input,
      avoid: [incidentOnStraight],
    });
    expect(result.strategy).toBe('detour');
  });

  it('từ chối dữ liệu sai trước khi gọi VietMap', async () => {
    const provider = providerReturning();
    await expect(new RerouteUseCase(provider).execute({ ...input, stops: [], avoid: [] })).rejects.toThrow();
    expect(provider.calculateAlternatives).not.toHaveBeenCalled();
  });
});
