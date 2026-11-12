import type { Coordinate } from '../../map/types';

const METERS_PER_DEGREE = 111_320;

/** Khoảng cách (m) từ điểm p tới đoạn a–b, tọa độ [vĩ độ, kinh độ], xấp xỉ phẳng đủ cho quy mô tuyến. */
function distanceToSegment(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const cos = Math.cos((p[0] * Math.PI) / 180);
  const ax = (a[1] - p[1]) * METERS_PER_DEGREE * cos;
  const ay = (a[0] - p[0]) * METERS_PER_DEGREE;
  const bx = (b[1] - p[1]) * METERS_PER_DEGREE * cos;
  const by = (b[0] - p[0]) * METERS_PER_DEGREE;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Douglas–Peucker (không đệ quy) với dung sai `toleranceM`; luôn giữ điểm đầu và cuối. */
function douglasPeucker(path: Coordinate[], toleranceM: number): Coordinate[] {
  const keep = new Array<boolean>(path.length).fill(false);
  keep[0] = true;
  keep[path.length - 1] = true;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let farthest = -1;
    let maxDistance = toleranceM;
    for (let index = start + 1; index < end; index++) {
      const distance = distanceToSegment(path[index]!, path[start]!, path[end]!);
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = index;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return path.filter((_, index) => keep[index]);
}

/**
 * Rút gọn tuyến còn tối đa `maxPoints` điểm (API giới hạn 500) mà vẫn bám đường: tăng dần dung sai
 * Douglas–Peucker; nếu vẫn dư thì lấy đều. Tọa độ làm tròn 5 chữ số (~1 m) cho gọn.
 */
export function simplifyPath(path: Coordinate[], maxPoints = 500): Coordinate[] {
  const round = (point: Coordinate): Coordinate => [
    Math.round(point[0] * 1e5) / 1e5,
    Math.round(point[1] * 1e5) / 1e5,
  ];
  if (path.length <= 2) return path.map(round);
  let simplified = path;
  for (let tolerance = 5; simplified.length > maxPoints && tolerance <= 5000; tolerance *= 2) {
    simplified = douglasPeucker(path, tolerance);
  }
  if (simplified.length > maxPoints) {
    const step = (simplified.length - 1) / (maxPoints - 1);
    simplified = Array.from({ length: maxPoints }, (_, index) => simplified[Math.round(index * step)]!);
  }
  return simplified.map(round);
}
