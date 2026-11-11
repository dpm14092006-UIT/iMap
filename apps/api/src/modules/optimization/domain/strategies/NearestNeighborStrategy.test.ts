import { describe, expect, it } from 'vitest';
import { NearestNeighborStrategy } from './NearestNeighborStrategy.js';

const solver = new NearestNeighborStrategy();

describe('NearestNeighborStrategy', () => {
  it('giữ điểm xuất phát, luôn đi tới điểm gần nhất và không bỏ sót điểm', () => {
    expect(solver.optimize([[0, 4, 1], [2, 0, 1], [2, 1, 0]])).toEqual({ order: [0, 2, 1], cost: 2 });
  });

  it('quay về điểm xuất phát khi được yêu cầu (cộng cả chặng về)', () => {
    expect(solver.optimize([[0, 4, 1], [2, 0, 1], [2, 1, 0]], true)).toEqual({ order: [0, 2, 1, 0], cost: 4 });
  });

  it('báo lỗi khi không còn đường tới điểm chưa ghé', () => {
    expect(() => solver.optimize([[0, 1, Infinity], [Infinity, 0, Infinity], [1, 1, 0]])).toThrow();
  });
});
