import { describe, expect, it } from 'vitest';
import type { Coordinate } from '../../map/types';
import { simplifyPath } from './simplifyPath';

describe('simplifyPath', () => {
  it('giữ nguyên tuyến ngắn (chỉ làm tròn 5 chữ số)', () => {
    expect(
      simplifyPath([
        [10.123456, 106.654321],
        [10.2, 106.7],
      ]),
    ).toEqual([
      [10.12346, 106.65432],
      [10.2, 106.7],
    ]);
  });

  it('rút tuyến dài còn tối đa 500 điểm, giữ hai đầu', () => {
    // Đường lượn sóng 3000 điểm.
    const path: Coordinate[] = Array.from({ length: 3000 }, (_, i) => [
      10.7 + i * 0.00003,
      106.7 + Math.sin(i / 20) * 0.002 + i * 0.00002,
    ]);
    const result = simplifyPath(path);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result[0]).toEqual([10.7, 106.7]);
    expect(result.at(-1)![0]).toBeCloseTo(path.at(-1)![0], 4);
  });

  it('bỏ điểm thẳng hàng nhưng giữ khúc cua', () => {
    const path: Coordinate[] = [
      [10, 106],
      [10.001, 106],
      [10.002, 106],
      [10.002, 106.002],
    ];
    expect(simplifyPath(path, 3)).toEqual([
      [10, 106],
      [10.002, 106],
      [10.002, 106.002],
    ]);
  });
});
