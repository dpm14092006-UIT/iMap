import { describe, expect, it } from 'vitest';
import { ExactTourStrategy } from './ExactTourStrategy.js';
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
});
