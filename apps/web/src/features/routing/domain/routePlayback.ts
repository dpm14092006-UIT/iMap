import { bearingDegrees, haversineMeters } from '../../../shared/geo/distance';
import type { LatLng } from '../../../shared/geo/types';
import type { RoutePlan } from '../types';

/** Một điểm trên dòng thời gian của tuyến: giây kể từ lúc xuất phát. */
type Sample = { point: LatLng; seconds: number };

export type RoutePlaybackTimeline = {
  samples: Sample[];
  /** Tổng thời gian hành trình (giây) theo VietMap. */
  totalSeconds: number;
};

export type PlaybackFrame = { point: LatLng; heading: number };

type Step = { distanceMeters: number; durationSeconds: number };

/**
 * Gán mốc thời gian cho từng điểm của tuyến. Trong mỗi chặng, tốc độ lấy từ các chỉ dẫn VietMap
 * (quãng đường và thời gian từng đoạn); chặng không có chỉ dẫn thì chia đều thời gian chặng theo quãng đường.
 */
export function buildPlaybackTimeline(route: RoutePlan): RoutePlaybackTimeline {
  const samples: Sample[] = [];
  let elapsed = 0;
  for (const leg of route.legs) {
    const points = leg.points.map(([lat, lng]) => ({ lat, lng }));
    const cumulative: number[] = [];
    let meters = 0;
    points.forEach((point, index) => {
      const previous = points[index - 1];
      if (previous) meters += haversineMeters(previous, point);
      cumulative.push(meters);
    });
    const legSeconds = Math.max(0, leg.durationMin * 60);
    const timeAt = legTimeProfile(leg.instructions ?? [], meters, legSeconds);
    points.forEach((point, index) => {
      if (index === 0 && samples.length) return; // điểm nối giữa hai chặng
      samples.push({ point, seconds: elapsed + timeAt(cumulative[index] ?? 0) });
    });
    elapsed += legSeconds;
  }
  return { samples, totalSeconds: elapsed };
}

/** Hàm quãng đường (m) → thời gian (giây) trong một chặng, nội suy tuyến tính theo các đoạn chỉ dẫn. */
function legTimeProfile(instructions: Step[], legMeters: number, legSeconds: number) {
  const steps = instructions.filter((step) => step.distanceMeters > 0 && step.durationSeconds >= 0);
  const stepMeters = steps.reduce((sum, step) => sum + step.distanceMeters, 0);
  const stepSeconds = steps.reduce((sum, step) => sum + step.durationSeconds, 0);
  if (legMeters <= 0) return () => 0;
  if (stepMeters <= 0 || stepSeconds <= 0) return (meters: number) => (meters / legMeters) * legSeconds;
  // Co giãn để khớp chiều dài hình học tuyến và tổng thời gian chặng.
  const distanceScale = legMeters / stepMeters;
  const timeScale = legSeconds / stepSeconds;
  const knots: { meters: number; seconds: number }[] = [{ meters: 0, seconds: 0 }];
  let last = { meters: 0, seconds: 0 };
  for (const step of steps) {
    last = {
      meters: last.meters + step.distanceMeters * distanceScale,
      seconds: last.seconds + step.durationSeconds * timeScale,
    };
    knots.push(last);
  }
  return (meters: number) => {
    let previous = knots[0] ?? last;
    for (const knot of knots) {
      if (meters <= knot.meters) {
        const span = knot.meters - previous.meters;
        return span > 0
          ? previous.seconds + ((meters - previous.meters) / span) * (knot.seconds - previous.seconds)
          : knot.seconds;
      }
      previous = knot;
    }
    return legSeconds;
  };
}

/** Vị trí và hướng đi tại giây thứ `seconds` của hành trình (kẹp trong [0, tổng]). */
export function routePlayback(timeline: RoutePlaybackTimeline, seconds: number): PlaybackFrame | null {
  const { samples } = timeline;
  const first = samples[0];
  if (!first) return null;
  const t = Math.min(Math.max(seconds, 0), timeline.totalSeconds);
  let index = samples.findIndex((sample) => sample.seconds > t);
  if (index === -1) index = samples.length - 1;
  if (index === 0) index = 1;
  const start = samples[index - 1];
  const end = samples[index];
  if (!start || !end) return { point: first.point, heading: 0 };
  // Lùi qua các điểm trùng nhau để hướng đi không bị 0.
  let from = start.point;
  for (let back = index - 2; back >= 0 && sameSpot(from, end.point); back -= 1)
    from = samples[back]?.point ?? from;
  const span = end.seconds - start.seconds;
  const ratio = span > 0 ? Math.min(1, Math.max(0, (t - start.seconds) / span)) : 1;
  return {
    point: {
      lat: start.point.lat + (end.point.lat - start.point.lat) * ratio,
      lng: start.point.lng + (end.point.lng - start.point.lng) * ratio,
    },
    heading: sameSpot(from, end.point) ? 0 : bearingDegrees(from, end.point),
  };
}

function sameSpot(a: LatLng, b: LatLng) {
  return a.lat === b.lat && a.lng === b.lng;
}
