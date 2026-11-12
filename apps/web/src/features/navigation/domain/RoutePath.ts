import type { Coordinate } from '../../map/types';
import type { LatLng } from '../../places/types';
import { Geodesy } from './Geodesy';

/** Vị trí gần nhất của một điểm trên đường đi. */
export type PathMatch = {
  /** Khoảng cách từ điểm tới đường (mét). */
  distance: number;
  /** Quãng đường đã đi dọc hình học của tuyến tới vị trí đó (mét). */
  progress: number;
};

type Segment = { start: LatLng; end: LatLng; length: number; offset: number };

const toLatLng = ([lat, lng]: Coordinate): LatLng => ({ lat, lng });

/**
 * Hình học của một tuyến dưới dạng chuỗi đoạn thẳng nối liền nhau (gộp mọi chặng).
 * Tính sẵn độ dài từng đoạn một lần để việc khớp vị trí GPS lặp lại mỗi giây không phải tính lại.
 */
export class RoutePath {
  private readonly segments: Segment[] = [];
  /** Tổng chiều dài hình học (mét); có thể khác quãng đường VietMap báo do làm tròn đường cong. */
  readonly totalMeters: number;

  constructor(legs: ReadonlyArray<{ points: Coordinate[] }>) {
    let offset = 0;
    for (const leg of legs) {
      for (let index = 1; index < leg.points.length; index++) {
        const start = toLatLng(leg.points[index - 1]!);
        const end = toLatLng(leg.points[index]!);
        const length = Geodesy.distanceMeters(start, end);
        this.segments.push({ start, end, length, offset });
        offset += length;
      }
    }
    this.totalMeters = offset;
  }

  /** Điểm nằm trên tuyến sau khi đi được `progressMeters` mét từ đầu tuyến (dùng cho chế độ demo). */
  pointAt(progressMeters: number): LatLng {
    const last = this.segments[this.segments.length - 1];
    if (!last) return { lat: 0, lng: 0 };
    const target = Math.max(0, Math.min(progressMeters, this.totalMeters));
    const segment = this.segments.find((item) => item.offset + item.length >= target) ?? last;
    const fraction = segment.length === 0 ? 0 : (target - segment.offset) / segment.length;
    return {
      lat: segment.start.lat + (segment.end.lat - segment.start.lat) * fraction,
      lng: segment.start.lng + (segment.end.lng - segment.start.lng) * fraction,
    };
  }

  /**
   * Vị trí trên tuyến gần `point` nhất. Với `minProgress`, chỉ xét các đoạn mà tiến độ ≥ minProgress
   * (dùng để không "nhảy lùi" khi tuyến đi qua cùng một con đường hai lần).
   */
  closest(point: LatLng, minProgress = Number.NEGATIVE_INFINITY): PathMatch | null {
    let best: PathMatch | null = null;
    for (const segment of this.segments) {
      const projection = Geodesy.projectOntoSegment(point, segment.start, segment.end);
      const progress = segment.offset + segment.length * projection.fraction;
      if (progress < minProgress) continue;
      if (!best || projection.distance < best.distance) best = { distance: projection.distance, progress };
    }
    return best;
  }
}
