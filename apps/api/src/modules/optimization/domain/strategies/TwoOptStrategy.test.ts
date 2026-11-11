import { describe, expect, it } from 'vitest';
import { tourCost } from '../tour.js';
import { ExactTourStrategy } from './ExactTourStrategy.js';
import { NearestNeighborStrategy } from './NearestNeighborStrategy.js';
import { TwoOptStrategy } from './TwoOptStrategy.js';

const twoOpt = new TwoOptStrategy();

/** Ma trận có hướng giả lập: chi phí theo khoảng cách + lệch ngẫu nhiên mỗi chiều (đường một chiều). */
function randomDirectedMatrix(size: number, seed: number): number[][] {
  let state = seed;
  const random = () => (state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
  const points = Array.from({ length: size }, () => ({ x: random() * 100, y: random() * 100 }));
  return points.map((a, i) =>
    points.map((b, j) => (i === j ? 0 : Math.round(Math.hypot(a.x - b.x, a.y - b.y) * (1 + random() * 0.6)))),
  );
}

describe('TwoOptStrategy (NN + 2-opt)', () => {
  it('sửa được bẫy của Nearest Neighbor', () => {
    // NN đi 0→1→2→3 (tốn 1 + 1 + 100); thứ tự tốt hơn là 0→1→3→2 (tốn 1 + 2 + 1).
    const matrix = [
      [0, 1, 2, 9],
      [9, 0, 1, 2],
      [9, 1, 0, 100],
      [9, 9, 1, 0],
    ];
    expect(new NearestNeighborStrategy().optimize(matrix).cost).toBe(102);
    expect(twoOpt.optimize(matrix)).toEqual({ order: [0, 1, 3, 2], cost: 4 });
  });

  it.each([false, true])(
    'không bao giờ tệ hơn NN, giữ đúng điểm đầu/cuối và đủ điểm (khép kín = %s)',
    (closed) => {
      for (let seed = 1; seed <= 30; seed++) {
        const matrix = randomDirectedMatrix(12, seed);
        const result = twoOpt.optimize(matrix, closed);
        expect(result.cost).toBeLessThanOrEqual(new NearestNeighborStrategy().optimize(matrix, closed).cost);
        expect(result.cost).toBe(tourCost(matrix, result.order));
        expect(result.order[0]).toBe(0);
        expect(new Set(result.order).size).toBe(12);
        if (closed) expect(result.order.at(-1)).toBe(0);
      }
    },
  );

  it('không tốt hơn lời giải chính xác (Held–Karp) và thường bằng nó', () => {
    let equal = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const matrix = randomDirectedMatrix(8, seed);
      const exact = new ExactTourStrategy().optimize(matrix).cost;
      const heuristic = twoOpt.optimize(matrix).cost;
      expect(heuristic).toBeGreaterThanOrEqual(exact);
      if (heuristic === exact) equal += 1;
    }
    expect(equal).toBeGreaterThan(15); // đa số trường hợp nhỏ 2-opt tìm ra tối ưu
  });

  it('giữ thứ tự người dùng nhập khi không cải thiện được', () => {
    expect(
      twoOpt.optimize([
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ]),
    ).toEqual({ order: [0, 1, 2], cost: 2 });
  });

  it('chạy được cả khi vượt giới hạn của Held–Karp', () => {
    const matrix = randomDirectedMatrix(ExactTourStrategy.MAX_POINTS + 4, 7);
    expect(() => new ExactTourStrategy().optimize(matrix)).toThrow();
    expect(twoOpt.optimize(matrix).order).toHaveLength(ExactTourStrategy.MAX_POINTS + 4);
  });
});
