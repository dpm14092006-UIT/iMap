import { describe, expect, it } from 'vitest';
import type { Coordinate, RoutePlan } from '../../map/types';
import {
  congestionShares,
  formatCongestionLength,
  routeCongestionTone,
  splitRouteByCongestion,
  worstCongestionLevel,
} from './routeCongestion';

// 11 điểm cách nhau ~111 m theo kinh độ... dùng vĩ độ để dễ tính: 0.001° ≈ 111 m.
const line: Coordinate[] = Array.from({ length: 11 }, (_, index) => [index * 0.001, 106]);
const plan = (congestion: RoutePlan['congestion']) =>
  ({ legs: [{ points: line }], congestion }) as unknown as RoutePlan;

describe('splitRouteByCongestion', () => {
  it('cắt theo chỉ số, chia sẻ điểm nối và gộp đoạn cùng mức', () => {
    const result = splitRouteByCongestion(line, [
      { level: 'low', from: 0, to: 3 },
      { level: 'low', from: 3, to: 4 },
      { level: 'severe', from: 4, to: 6 },
    ]);
    expect(result.map((part) => [part.level, part.points.length])).toEqual([
      ['low', 5],
      ['severe', 3],
      ['unknown', 5],
    ]);
    expect(result[0]!.points.at(-1)).toEqual(result[1]!.points[0]);
    expect(result[1]!.points.at(-1)).toEqual(result[2]!.points[0]);
  });

  it('điền unknown vào khoảng trống, cắt chỉ số ngoài phạm vi và xử lý tuyến ngắn', () => {
    expect(splitRouteByCongestion(line, [])).toEqual([{ level: 'unknown', points: line }]);
    const clipped = splitRouteByCongestion(line, [{ level: 'heavy', from: 8, to: 99 }]);
    expect(clipped.map((part) => part.level)).toEqual(['unknown', 'heavy']);
    expect(clipped[1]!.points).toHaveLength(3);
    expect(splitRouteByCongestion([[0, 0]], [{ level: 'low', from: 0, to: 0 }])).toEqual([]);
  });
});

describe('routeCongestionTone', () => {
  it('null khi không có dữ liệu', () => {
    expect(routeCongestionTone(plan(undefined))).toBeNull();
    expect(routeCongestionTone(plan({ segments: [], heavyMeters: 0 }))).toBeNull();
  });
  it('đỏ khi có đoạn tắc hoặc ùn từ 1 km', () => {
    expect(
      routeCongestionTone(plan({ segments: [{ level: 'severe', from: 0, to: 1 }], heavyMeters: 0 })),
    ).toBe('red');
    expect(
      routeCongestionTone(plan({ segments: [{ level: 'low', from: 0, to: 10 }], heavyMeters: 1000 })),
    ).toBe('red');
  });
  it('vàng khi vừa phải >= 15% chiều dài hoặc có ùn dưới 1 km', () => {
    expect(
      routeCongestionTone(
        plan({
          segments: [
            { level: 'moderate', from: 0, to: 2 },
            { level: 'low', from: 2, to: 10 },
          ],
          heavyMeters: 0,
        }),
      ),
    ).toBe('amber');
    expect(
      routeCongestionTone(plan({ segments: [{ level: 'low', from: 0, to: 10 }], heavyMeters: 300 })),
    ).toBe('amber');
  });
  it('xanh khi thông thoáng hoặc vừa phải dưới 15%', () => {
    expect(
      routeCongestionTone(
        plan({
          segments: [
            { level: 'moderate', from: 0, to: 1 },
            { level: 'low', from: 1, to: 10 },
          ],
          heavyMeters: 0,
        }),
      ),
    ).toBe('green');
  });
});

describe('congestion helpers', () => {
  it('tính tỉ lệ theo chiều dài và mức tệ nhất', () => {
    const congestion = {
      segments: [
        { level: 'low' as const, from: 0, to: 5 },
        { level: 'heavy' as const, from: 5, to: 10 },
      ],
      heavyMeters: 555,
    };
    const shares = congestionShares(plan(congestion));
    expect(shares.map((item) => item.level)).toEqual(['low', 'heavy']);
    expect(shares[0]!.share).toBeCloseTo(0.5, 2);
    expect(worstCongestionLevel(congestion)).toBe('heavy');
    expect(
      worstCongestionLevel({ segments: [{ level: 'unknown', from: 0, to: 1 }], heavyMeters: 0 }),
    ).toBeNull();
  });
  it('định dạng độ dài theo ngôn ngữ', () => {
    expect(formatCongestionLength(2300)).toBe('2,3 km');
    expect(formatCongestionLength(140)).toBe('140 m');
    expect(formatCongestionLength(12300, 'en')).toBe('12.3 km');
    expect(formatCongestionLength(140, 'en')).toBe('140 m');
  });
});

const congestionScenarios = Array.from({ length: 100 }, (_, scenario) => {
  const edgeCount = scenario + 2;
  const points: Coordinate[] = Array.from({ length: edgeCount + 1 }, (_, index) => [
    10 + scenario * 0.001,
    106 + index * 0.001,
  ]);
  const levels = ['low', 'moderate', 'heavy', 'severe'] as const;
  const firstFrom = Math.floor(edgeCount * 0.17);
  const firstTo = Math.max(firstFrom + 1, Math.floor(edgeCount * 0.68));
  const secondFrom = Math.floor(edgeCount * 0.47);
  const segments = [
    { level: levels[scenario % levels.length]!, from: firstFrom, to: firstTo },
    { level: levels[(scenario + 1) % levels.length]!, from: secondFrom, to: edgeCount },
  ];
  return { points, edgeCount, segments };
});

describe('congestion split regression matrix', () => {
  it.each(congestionScenarios)(
    'preserves every edge for $edgeCount edges',
    ({ points, edgeCount, segments }) => {
      const expectedLevels = new Array<string>(edgeCount).fill('unknown');
      for (const { level, from, to } of segments) {
        for (let edge = from; edge < to; edge++) expectedLevels[edge] = level;
      }

      const result = splitRouteByCongestion(points, segments);
      const actualLevels = result.flatMap((part) => Array<string>(part.points.length - 1).fill(part.level));
      const reconstructed = result.length
        ? [...result[0]!.points, ...result.slice(1).flatMap((part) => part.points.slice(1))]
        : [];

      expect(actualLevels).toEqual(expectedLevels);
      expect(reconstructed).toEqual(points);
      expect(result.every((part) => part.points.length >= 2)).toBe(true);
    },
  );
});
