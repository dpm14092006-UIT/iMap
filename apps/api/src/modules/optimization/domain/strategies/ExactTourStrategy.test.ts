import { describe, expect, it } from 'vitest';
import { MAX_OPTIMIZE_POINTS, optimizeRouteRequestSchema } from '@routetwin/shared';
import { tourCost } from '../tour.js';
import { ExactTourStrategy } from './ExactTourStrategy.js';

/** Ma trận bất đối xứng xác định (không ngẫu nhiên) để test lặp lại được. */
const matrixOf = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : 1 + ((i * 7 + j * 13 + i * j) % 17))),
  );
const solver = new ExactTourStrategy();
function brute(matrix: number[][], closed: boolean) {
  let best = Infinity;
  const visit = (order: number[], rest: number[], cost: number) => {
    if (!rest.length) {
      best = Math.min(best, cost + (closed ? matrix[order.at(-1)!]![0]! : 0));
      return;
    }
    for (const next of rest)
      visit(
        [...order, next],
        rest.filter((n) => n !== next),
        cost + matrix[order.at(-1)!]![next]!,
      );
  };
  visit(
    [0],
    matrix.slice(1).map((_, i) => i + 1),
    0,
  );
  return best;
}
describe('exact road-cost ordering', () => {
  it('fixes a greedy nearest-neighbor trap and keeps departure fixed', () => {
    const matrix = [
      [0, 1, 2, 9],
      [9, 0, 1, 2],
      [9, 1, 0, 100],
      [9, 9, 1, 0],
    ];
    const result = solver.optimize(matrix);
    expect(result).toEqual({ order: [0, 1, 3, 2], cost: 4 });
  });
  it.each([false, true])(
    'matches an independent exhaustive oracle on directed matrices, closed=%s',
    (closed) => {
      for (let seed = 1; seed < 10; seed++) {
        const matrix = Array.from({ length: 5 }, (_, i) =>
          Array.from({ length: 5 }, (_, j) =>
            i === j ? 0 : ((i * 37 + j * 13 + seed * (i + 2) * (j + 1)) % 47) + 1,
          ),
        );
        const result = solver.optimize(matrix, closed);
        expect(result.cost).toBe(brute(matrix, closed));
        expect(result.order[0]).toBe(0);
        expect(new Set(result.order).size).toBe(5);
        if (closed) expect(result.order.at(-1)).toBe(0);
      }
    },
  );
  it('keeps a valid route when some directed edges are unreachable', () => {
    expect(
      solver.optimize(
        [
          [0, 1, Infinity],
          [Infinity, 0, 2],
          [3, Infinity, 0],
        ],
        true,
      ),
    ).toEqual({ order: [0, 1, 2, 0], cost: 6 });
  });
  it('rejects disconnected tours, invalid shape, negative or NaN costs', () => {
    expect(() =>
      solver.optimize([
        [0, Infinity],
        [Infinity, 0],
      ]),
    ).toThrow();
    expect(() => solver.optimize([[0, 1], [2]])).toThrow();
    expect(() =>
      solver.optimize([
        [0, -1],
        [2, 0],
      ]),
    ).toThrow();
    expect(() =>
      solver.optimize([
        [0, NaN],
        [2, 0],
      ]),
    ).toThrow();
  });
  it('keeps original order when multiple orders have the same total cost', () => {
    expect(
      solver.optimize([
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ]),
    ).toEqual({ order: [0, 1, 2], cost: 2 });
  });

  it('giới hạn của thuật toán trùng giới hạn của schema API (một nguồn duy nhất)', () => {
    expect(ExactTourStrategy.MAX_POINTS).toBe(MAX_OPTIMIZE_POINTS);
    const point = (i: number) => ({ lat: 10 + i * 0.01, lng: 106 });
    const request = (count: number) => ({
      points: Array.from({ length: count }, (_, i) => point(i)),
      vehicle: 'car',
    });
    expect(optimizeRouteRequestSchema.safeParse(request(MAX_OPTIMIZE_POINTS)).success).toBe(true);
    expect(optimizeRouteRequestSchema.safeParse(request(MAX_OPTIMIZE_POINTS + 1)).success).toBe(false);
  });
  it('giải được đủ số điểm tối đa, chạy nhanh và không tệ hơn thứ tự nhập', () => {
    const matrix = matrixOf(ExactTourStrategy.MAX_POINTS);
    const startedAt = performance.now();
    const result = solver.optimize(matrix, true);
    expect(performance.now() - startedAt).toBeLessThan(2000);
    expect(result.order).toHaveLength(ExactTourStrategy.MAX_POINTS + 1);
    expect(new Set(result.order.slice(0, -1)).size).toBe(ExactTourStrategy.MAX_POINTS);
    expect(result.cost).toBe(tourCost(matrix, result.order));
    expect(result.cost).toBeLessThanOrEqual(tourCost(matrix, [...matrix.keys(), 0]));
  });
  it('từ chối nhiều điểm hơn giới hạn', () => {
    expect(() => solver.optimize(matrixOf(ExactTourStrategy.MAX_POINTS + 1))).toThrow();
  });
  it('khớp vét cạn trên ma trận có ô không có đường', () => {
    const n = 7;
    const matrix = matrixOf(n).map((row, i) =>
      row.map((value, j) => ((i + 2 * j) % 5 === 0 && i !== j ? Infinity : value)),
    );
    const permutations = (items: number[]): number[][] =>
      items.length <= 1
        ? [items]
        : items.flatMap((item, i) =>
            permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
          );
    const bruteForce = Math.min(
      ...permutations([1, 2, 3, 4, 5, 6]).map((rest) => tourCost(matrix, [0, ...rest])),
    );
    expect(solver.optimize(matrix).cost).toBe(bruteForce);
  });
});
