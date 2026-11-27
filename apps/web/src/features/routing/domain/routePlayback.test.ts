import { describe, expect, it } from 'vitest';
import type { RouteLeg, RoutePlan } from '../types';
import { buildPlaybackTimeline, remainingSecondsAt, routePlayback } from './routePlayback';

const leg = (points: [number, number][], durationMin: number, instructions?: RouteLeg['instructions']) =>
  ({ points, durationMin, distanceKm: 0, nodes: [], instructions }) as unknown as RouteLeg;
const plan = (legs: RouteLeg[]) => ({ legs }) as unknown as RoutePlan;

// Hai đoạn thẳng về phía Bắc, mỗi đoạn ~1,11 km.
const north: [number, number][] = [
  [10, 106],
  [10.01, 106],
  [10.02, 106],
];

describe('routePlayback', () => {
  it('đi hết tuyến đúng tổng thời gian của chặng, hướng Bắc', () => {
    const timeline = buildPlaybackTimeline(plan([leg(north, 10)]));
    expect(timeline.totalSeconds).toBe(600);
    expect(routePlayback(timeline, 0)?.point).toEqual({ lat: 10, lng: 106 });
    expect(routePlayback(timeline, 600)?.point.lat).toBeCloseTo(10.02, 6);
    expect(routePlayback(timeline, 300)?.point.lat).toBeCloseTo(10.01, 4);
    expect(routePlayback(timeline, 300)?.heading).toBeCloseTo(0, 1);
    expect(routePlayback(timeline, 9999)?.point.lat).toBeCloseTo(10.02, 6);
  });

  it('dùng tốc độ theo từng chỉ dẫn: đoạn đầu chậm gấp 3 đoạn sau', () => {
    const timeline = buildPlaybackTimeline(
      plan([
        leg(north, 4, [
          { distanceMeters: 1000, durationSeconds: 180, text: '', streetName: '' },
          { distanceMeters: 1000, durationSeconds: 60, text: '', streetName: '' },
        ]),
      ]),
    );
    // Đoạn đầu chiếm 3/4 thời gian: tới giây 180 mới qua điểm giữa.
    expect(routePlayback(timeline, 180)?.point.lat).toBeCloseTo(10.01, 4);
    expect(routePlayback(timeline, 90)?.point.lat).toBeCloseTo(10.005, 4);
  });

  it('nối nhiều chặng, hướng Đông ở chặng sau', () => {
    const timeline = buildPlaybackTimeline(
      plan([
        leg(north, 5),
        leg(
          [
            [10.02, 106],
            [10.02, 106.02],
          ],
          5,
        ),
      ]),
    );
    expect(timeline.totalSeconds).toBe(600);
    const frame = routePlayback(timeline, 450);
    expect(frame?.point.lng).toBeCloseTo(106.01, 4);
    expect(frame?.heading).toBeCloseTo(90, 0);
  });

  it('tuyến rỗng thì không có khung hình', () => {
    expect(routePlayback(buildPlaybackTimeline(plan([])), 0)).toBeNull();
  });
});

describe('remainingSecondsAt (giờ đến khi dẫn đường)', () => {
  const timeline = buildPlaybackTimeline(
    plan([
      leg(north, 4, [
        { distanceMeters: 1000, durationSeconds: 180, text: '', streetName: '' },
        { distanceMeters: 1000, durationSeconds: 60, text: '', streetName: '' },
      ]),
    ]),
  );
  it('đầu tuyến còn trọn thời gian, cuối tuyến còn 0', () => {
    expect(remainingSecondsAt(timeline, timeline.totalMeters)).toBeCloseTo(240, 3);
    expect(remainingSecondsAt(timeline, 0)).toBe(0);
    expect(remainingSecondsAt(timeline, timeline.totalMeters * 5)).toBeCloseTo(240, 3);
  });
  it('qua nửa quãng đường (đoạn chậm) chỉ còn 1/4 thời gian vì đoạn còn lại đi nhanh', () => {
    expect(remainingSecondsAt(timeline, timeline.totalMeters / 2)).toBeCloseTo(60, 0);
  });
});
