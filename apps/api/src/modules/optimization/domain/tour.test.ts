import { describe, expect, it } from 'vitest';
import { findIsolatedPoints, inputOrder, tourCost } from './tour.js';

describe('tour helpers', () => {
  it('tourCost cộng chi phí từng cặp điểm liên tiếp theo đúng chiều', () => {
    expect(
      tourCost(
        [
          [0, 1, 5],
          [9, 0, 2],
          [3, 9, 0],
        ],
        [0, 1, 2, 0],
      ),
    ).toBe(1 + 2 + 3);
  });

  it('inputOrder là thứ tự người dùng nhập, lặp lại điểm xuất phát khi quay về', () => {
    expect(inputOrder(3, false)).toEqual([0, 1, 2]);
    expect(inputOrder(3, true)).toEqual([0, 1, 2, 0]);
  });
});

describe('findIsolatedPoints', () => {
  it('hành trình mở: điểm ghé chỉ đi tới được (không đi ra) vẫn hợp lệ vì có thể là điểm cuối', () => {
    const matrix = [
      [0, 1, 1],
      [1, 0, 1],
      [Infinity, Infinity, 0],
    ];
    expect(findIsolatedPoints(matrix, false)).toEqual([]);
    expect(findIsolatedPoints(matrix, true)).toEqual([2]);
  });

  it('điểm không ai đi tới được luôn bị báo', () => {
    expect(
      findIsolatedPoints(
        [
          [0, 1, Infinity],
          [1, 0, Infinity],
          [1, 1, 0],
        ],
        false,
      ),
    ).toEqual([2]);
  });

  it('điểm xuất phát không đi ra được thì bị báo', () => {
    expect(
      findIsolatedPoints(
        [
          [0, Infinity, Infinity],
          [1, 0, 1],
          [1, 1, 0],
        ],
        false,
      ),
    ).toEqual([0]);
  });
});
