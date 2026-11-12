import type { CongestionLevel, RouteCongestion } from '@routetwin/shared';
import type { Coordinate, RoutePlan } from '../../map/types';

/** Một đoạn polyline cùng mức ùn tắc, sẵn sàng để vẽ. */
export type ColoredPolyline = { level: CongestionLevel; points: Coordinate[] };
export type CongestionTone = 'green' | 'amber' | 'red';

const METERS_PER_DEGREE = 111_320;
/** Thứ tự từ thoáng đến tắc; 'unknown' không tính là xấu nhất. */
export const CONGESTION_RANK: Record<CongestionLevel, number> = {
  unknown: -1,
  low: 0,
  moderate: 1,
  heavy: 2,
  severe: 3,
};
/** Màu vẽ trên bản đồ; null = giữ kiểu tuyến thông thường (đồng bộ tailwind `colors.traffic`). */
export const CONGESTION_COLORS: Record<CongestionLevel, string | null> = {
  low: '#22c55e',
  moderate: '#facc15',
  heavy: '#ef4444',
  severe: '#991b1b',
  unknown: null,
};
export const CONGESTION_LABELS: Record<CongestionLevel, string> = {
  low: 'Thông thoáng',
  moderate: 'Vừa phải',
  heavy: 'Đông',
  severe: 'Tắc',
  unknown: 'Chưa rõ',
};

function distance(a: Coordinate, b: Coordinate): number {
  const meanLat = ((a[0] + b[0]) / 2) * (Math.PI / 180);
  return Math.hypot((b[1] - a[1]) * METERS_PER_DEGREE * Math.cos(meanLat), (b[0] - a[0]) * METERS_PER_DEGREE);
}

/**
 * Cắt tuyến thành các polyline theo mức ùn tắc. Chỉ số from/to là chỉ số tọa độ (gồm cả hai đầu);
 * đoạn không được phủ sẽ là 'unknown', đoạn liền kề cùng mức được gộp, chỉ số ngoài phạm vi bị cắt bớt.
 */
export function splitRouteByCongestion(
  points: Coordinate[],
  segments: RouteCongestion['segments'],
): ColoredPolyline[] {
  if (points.length < 2) return [];
  const edgeCount = points.length - 1;
  // Mỗi cạnh i (points[i] -> points[i+1]) nhận mức của đoạn phủ nó; đoạn sau ghi đè đoạn trước.
  const edgeLevels: CongestionLevel[] = new Array<CongestionLevel>(edgeCount).fill('unknown');
  for (const { level, from, to } of segments) {
    const start = Math.max(0, Math.floor(from));
    const end = Math.min(edgeCount, Math.floor(to)); // cạnh cuối là to-1
    for (let edge = start; edge < end; edge++) edgeLevels[edge] = level;
  }
  const result: ColoredPolyline[] = [];
  for (let edge = 0; edge < edgeCount; edge++) {
    const last = result[result.length - 1];
    if (last && last.level === edgeLevels[edge]) last.points.push(points[edge + 1]!);
    else result.push({ level: edgeLevels[edge]!, points: [points[edge]!, points[edge + 1]!] });
  }
  return result;
}

/** Chiều dài (mét) theo từng mức, tính từ hình học tuyến. */
function congestionDistanceByLevel(
  points: Coordinate[],
  segments: RouteCongestion['segments'],
): Record<CongestionLevel, number> {
  const totals: Record<CongestionLevel, number> = { low: 0, moderate: 0, heavy: 0, severe: 0, unknown: 0 };
  for (const { level, points: part } of splitRouteByCongestion(points, segments)) {
    for (let index = 0; index < part.length - 1; index++)
      totals[level] += distance(part[index]!, part[index + 1]!);
  }
  return totals;
}

/** Mức tệ nhất trên tuyến (bỏ qua 'unknown'); null khi không có dữ liệu. */
export function worstCongestionLevel(congestion: RouteCongestion | undefined): CongestionLevel | null {
  let worst: CongestionLevel | null = null;
  for (const { level } of congestion?.segments ?? []) {
    if (level !== 'unknown' && (worst === null || CONGESTION_RANK[level] > CONGESTION_RANK[worst]))
      worst = level;
  }
  return worst;
}

/**
 * Tông màu thẻ tuyến theo dữ liệu thật: đỏ khi có đoạn tắc hoặc ùn ≥ 1 km; vàng khi đoạn vừa
 * chiếm ≥ 15% chiều dài hoặc có ùn nhẹ; xanh còn lại. null khi tuyến không có dữ liệu.
 */
export function routeCongestionTone(route: Pick<RoutePlan, 'legs' | 'congestion'>): CongestionTone | null {
  const { congestion } = route;
  if (!congestion?.segments.length) return null;
  if (congestion.segments.some((segment) => segment.level === 'severe') || congestion.heavyMeters >= 1000)
    return 'red';
  const points = route.legs.flatMap((leg) => leg.points);
  const byLevel = congestionDistanceByLevel(points, congestion.segments);
  const total = Object.values(byLevel).reduce((sum, value) => sum + value, 0);
  if ((total > 0 && byLevel.moderate / total >= 0.15) || congestion.heavyMeters > 0) return 'amber';
  return 'green';
}

/** Tỉ lệ chiều dài theo mức (0..1) cho thanh xếp chồng; bỏ mức 0 và 'unknown'. */
export function congestionShares(
  route: Pick<RoutePlan, 'legs' | 'congestion'>,
): { level: CongestionLevel; share: number }[] {
  const { congestion } = route;
  if (!congestion?.segments.length) return [];
  const byLevel = congestionDistanceByLevel(
    route.legs.flatMap((leg) => leg.points),
    congestion.segments,
  );
  const total = Object.values(byLevel).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  return (['low', 'moderate', 'heavy', 'severe', 'unknown'] as const)
    .filter((level) => byLevel[level] > 0)
    .map((level) => ({ level, share: byLevel[level] / total }));
}

/** "2,3 km" khi ≥ 1 km, "850 m" khi nhỏ hơn (định dạng số Việt Nam). */
export function formatCongestionLength(meters: number): string {
  if (meters >= 1000)
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(meters / 10) * 10)} m`;
}
