import { describe, expect, it } from 'vitest';
import type { Coordinate } from '../types';
import { pickRouteLabelPoints } from './routeLabelPlacement';

const line = (from: Coordinate, to: Coordinate, n = 20): Coordinate[] =>
  Array.from({ length: n + 1 }, (_, i) => [
    from[0] + ((to[0] - from[0]) * i) / n,
    from[1] + ((to[1] - from[1]) * i) / n,
  ]);

describe('pickRouteLabelPoints', () => {
  it('đặt nhãn ở đoạn tách xa tuyến kia, không phải điểm giữa dùng chung', () => {
    // Hai tuyến cùng đi chung nửa đầu, rẽ khác hướng ở nửa sau.
    const shared = line([10, 106], [10.5, 106.5]);
    const a = [...shared, ...line([10.5, 106.5], [10.9, 106.5])];
    const b = [...shared, ...line([10.5, 106.5], [10.5, 107])];
    const [pa, pb] = pickRouteLabelPoints([a, b]);
    expect(pa![0]).toBeGreaterThan(10.55);
    expect(pb![1]).toBeGreaterThan(106.55);
  });

  it('tuyến duy nhất đặt ở giữa', () => {
    const only = line([10, 106], [11, 107]);
    expect(pickRouteLabelPoints([only])[0]).toEqual(only[10]);
  });

  it('hai nhãn không trùng vị trí', () => {
    const a = line([10, 106], [11, 107]);
    const b = line([10, 106.1], [11, 107.1]);
    const [pa, pb] = pickRouteLabelPoints([a, b]);
    expect(pa).not.toEqual(pb);
  });

  it('hai tuyến gần như trùng nhau vẫn có nhãn cách xa nhau', () => {
    const a = line([10, 106], [11, 107], 40);
    const b = line([10, 106.0005], [11, 107.0005], 40);
    const [pa, pb] = pickRouteLabelPoints([a, b]);
    expect(Math.hypot(pa![0] - pb![0], pa![1] - pb![1])).toBeGreaterThan(0.15);
  });
});
