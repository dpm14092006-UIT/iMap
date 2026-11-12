import { describe, expect, it } from 'vitest';
import {
  detourMinutes,
  haversineMeters,
  pathLengthMeters,
  projectOnPath,
  sampleAlongPath,
  type LatLngTuple,
} from './poi-geometry.js';

/** ~11,1 km theo hướng bắc: 0,1 độ vĩ. */
const straight: LatLngTuple[] = [
  [10.7, 106.7],
  [10.8, 106.7],
];

describe('sampleAlongPath', () => {
  it('lấy hai đầu, tuyến rất dài vẫn không quá 8 điểm', () => {
    const long: LatLngTuple[] = [
      [10.0, 106.0],
      [11.0, 106.0],
    ];
    const samples = sampleAlongPath(long, 500);
    expect(samples).toHaveLength(8); // sẽ là 11 nếu không có trần
    expect(samples.length).toBeLessThanOrEqual(8);
    expect(samples[0]).toEqual({ lat: 10, lng: 106 });
    expect(samples.at(-1)!.lat).toBeCloseTo(11, 6);
  });

  it('khoảng cách giữa các điểm mẫu xấp xỉ max(1,6 × bán kính, dài / 10) và không vượt quá', () => {
    const total = pathLengthMeters(straight);
    const radius = 1500;
    const samples = sampleAlongPath(straight, radius);
    const spacing = Math.max(1.6 * radius, total / 10);
    expect(samples).toHaveLength(Math.ceil(total / spacing) + 1);
    for (let i = 1; i < samples.length; i++)
      expect(haversineMeters(samples[i - 1]!, samples[i]!)).toBeLessThanOrEqual(spacing + 1);
  });

  it('tuyến ngắn vẫn có đủ hai đầu; tuyến một điểm hay trùng điểm chỉ có một mẫu', () => {
    expect(
      sampleAlongPath(
        [
          [10, 106],
          [10.0005, 106],
        ],
        1500,
      ),
    ).toHaveLength(2);
    expect(
      sampleAlongPath(
        [
          [10, 106],
          [10, 106],
        ],
        1500,
      ),
    ).toHaveLength(1);
  });
});

describe('projectOnPath', () => {
  it('trả khoảng cách vuông góc và vị trí dọc tuyến', () => {
    // 0,001 độ kinh ≈ 109,6 m ở vĩ độ 10,75; chiếu lên điểm giữa tuyến.
    const result = projectOnPath({ lat: 10.75, lng: 106.701 }, straight);
    expect(result.distanceM).toBeGreaterThan(100);
    expect(result.distanceM).toBeLessThan(120);
    expect(result.alongM).toBeCloseTo(pathLengthMeters(straight) / 2, -1);
  });

  it('điểm ngoài đầu tuyến được kẹp về đầu tuyến', () => {
    const result = projectOnPath({ lat: 10.69, lng: 106.7 }, straight);
    expect(result.alongM).toBe(0);
    expect(result.distanceM).toBeCloseTo(
      haversineMeters({ lat: 10.69, lng: 106.7 }, { lat: 10.7, lng: 106.7 }),
      -1,
    );
  });
});

describe('detourMinutes', () => {
  it('= 2 × khoảng cách ÷ 25 km/h, làm tròn phút', () => {
    expect(detourMinutes(0)).toBe(0);
    expect(detourMinutes(1500)).toBe(7); // 3 km / 25 km/h = 7,2 phút
    expect(detourMinutes(5000)).toBe(24);
  });
});
