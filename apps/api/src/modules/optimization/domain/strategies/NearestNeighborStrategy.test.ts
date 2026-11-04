import { describe, it, expect } from 'vitest';
import { NearestNeighborStrategy } from './NearestNeighborStrategy.js';
describe('NearestNeighborStrategy', () => {
  it('giữ điểm xuất phát và không bỏ sót điểm', () => {
    const order = new NearestNeighborStrategy().optimize([[0,4,1],[2,0,1],[2,1,0]]);
    expect(order).toEqual([0,2,1]);
  });
});
