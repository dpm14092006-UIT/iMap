import { describe, expect, it, vi } from 'vitest';
import { OptimizeRouteUseCase } from './OptimizeRouteUseCase.js';
const input = {
  points: [
    { lat: 10.77, lng: 106.69 },
    { lat: 10.78, lng: 106.7 },
    { lat: 10.79, lng: 106.71 },
  ],
  vehicle: 'car' as const,
  objective: 'distance' as const,
  returnToStart: false,
};
const route = {
  source: 'vietmap' as const,
  distanceMeters: 10,
  durationSeconds: 4,
  coordinates: [
    [106.69, 10.77],
    [106.71, 10.79],
  ] as [number, number][],
  instructions: [],
};
describe('optimize route integration boundary', () => {
  it('orders by road cost, forwards vehicle/objective and renders a single actual road route', async () => {
    const matrices = {
      getCosts: vi.fn().mockResolvedValue([
        [0, 100, 1],
        [100, 0, 100],
        [100, 1, 0],
      ]),
    };
    const routes = { calculate: vi.fn().mockResolvedValue(route) };
    const output = await new OptimizeRouteUseCase(matrices, routes).execute(input);
    expect(output).toMatchObject({
      order: [0, 2, 1],
      originalCost: 200,
      optimizedCost: 2,
      objective: 'distance',
      route,
    });
    expect(routes.calculate).toHaveBeenCalledExactlyOnceWith({
      points: [input.points[0], input.points[2], input.points[1]],
      vehicle: 'car',
      objective: 'distance',
    });
  });
  it('returns to departure exactly once when requested', async () => {
    const matrices = {
      getCosts: vi.fn().mockResolvedValue([
        [0, 1, 5],
        [5, 0, 1],
        [1, 5, 0],
      ]),
    };
    const routes = { calculate: vi.fn().mockResolvedValue(route) };
    const output = await new OptimizeRouteUseCase(matrices, routes).execute({
      ...input,
      returnToStart: true,
    });
    expect(output.order).toEqual([0, 1, 2, 0]);
    expect(routes.calculate.mock.calls[0]![0].points).toHaveLength(4);
  });
  it('rejects duplicate positions before any billed matrix request', async () => {
    const matrices = { getCosts: vi.fn() };
    const routes = { calculate: vi.fn() };
    await expect(
      new OptimizeRouteUseCase(matrices, routes).execute({
        ...input,
        points: [input.points[0]!, input.points[0]!],
      }),
    ).rejects.toThrow();
    expect(matrices.getCosts).not.toHaveBeenCalled();
  });
  it('does not calculate fabricated routes when no complete tour exists', async () => {
    const matrices = {
      getCosts: vi.fn().mockResolvedValue([
        [0, Infinity, Infinity],
        [1, 0, Infinity],
        [1, 1, 0],
      ]),
    };
    const routes = { calculate: vi.fn() };
    await expect(new OptimizeRouteUseCase(matrices, routes).execute(input)).rejects.toMatchObject({
      code: 'TOUR_UNREACHABLE',
    });
    expect(routes.calculate).not.toHaveBeenCalled();
  });
});

describe('chọn thuật toán sắp xếp điểm ghé', () => {
  const route = {
    source: 'vietmap' as const,
    distanceMeters: 10,
    durationSeconds: 4,
    coordinates: [
      [106.69, 10.77],
      [106.71, 10.79],
    ] as [number, number][],
    instructions: [],
  };
  /** n điểm khác nhau quanh trung tâm TP.HCM. */
  const points = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ lat: 10.77 + i * 0.001, lng: 106.69 + i * 0.001 }));
  const matrixOf = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : Math.abs(i - j) * 10)),
    );
  const setup = (n: number) => {
    const exact = {
      name: 'exact',
      optimize: vi.fn((m: number[][]) => ({ order: m.map((_, i) => i), cost: 1 })),
    };
    const heuristic = {
      name: 'heuristic',
      optimize: vi.fn((m: number[][]) => ({ order: m.map((_, i) => i), cost: 2 })),
    };
    const useCase = new OptimizeRouteUseCase(
      { getCosts: vi.fn().mockResolvedValue(matrixOf(n)) },
      { calculate: vi.fn().mockResolvedValue(route) },
      { exact, heuristic },
    );
    return { exact, heuristic, useCase };
  };

  it('auto dùng Held–Karp cho tới 15 điểm ghé', async () => {
    const { exact, heuristic, useCase } = setup(16);
    const output = await useCase.execute({
      points: points(16),
      vehicle: 'car',
      objective: 'duration',
      returnToStart: false,
      algorithm: 'auto',
    });
    expect(output.algorithm).toBe('exact');
    expect(exact.optimize).toHaveBeenCalledOnce();
    expect(heuristic.optimize).not.toHaveBeenCalled();
  });

  it('dùng NN + 2-opt khi người dùng chọn "heuristic"', async () => {
    const { exact, heuristic, useCase } = setup(12);
    const output = await useCase.execute({
      points: points(12),
      vehicle: 'car',
      objective: 'duration',
      returnToStart: false,
      algorithm: 'heuristic',
    });
    expect(output.algorithm).toBe('heuristic');
    expect(heuristic.optimize).toHaveBeenCalledOnce();
    expect(exact.optimize).not.toHaveBeenCalled();
  });

  it('từ chối quá 16 điểm', async () => {
    const { useCase } = setup(17);
    await expect(
      useCase.execute({
        points: points(17),
        vehicle: 'car',
        objective: 'duration',
        returnToStart: false,
        algorithm: 'auto',
      }),
    ).rejects.toThrow();
  });
});

describe('báo rõ điểm không có đường', () => {
  it('nêu đúng số thứ tự điểm ghé bị cô lập, không chạy thuật toán và không gọi Route', async () => {
    const isolatedMatrix = [
      [0, 5, -1, 5].map((v) => (v < 0 ? Infinity : v)),
      [5, 0, Infinity, 5],
      [Infinity, Infinity, 0, Infinity],
      [5, 5, Infinity, 0],
    ];
    const calculate = vi.fn();
    const useCase = new OptimizeRouteUseCase(
      { getCosts: vi.fn().mockResolvedValue(isolatedMatrix) },
      { calculate },
    );
    const points = [
      { lat: 10.77, lng: 106.69 },
      { lat: 10.78, lng: 106.7 },
      { lat: 10.79, lng: 106.71 },
      { lat: 10.8, lng: 106.72 },
    ];
    await expect(
      useCase.execute({
        points,
        vehicle: 'motorcycle',
        objective: 'duration',
        returnToStart: false,
        algorithm: 'auto',
      }),
    ).rejects.toMatchObject({ code: 'TOUR_UNREACHABLE', message: expect.stringContaining('điểm ghé số 2') });
    expect(calculate).not.toHaveBeenCalled();
  });
});
