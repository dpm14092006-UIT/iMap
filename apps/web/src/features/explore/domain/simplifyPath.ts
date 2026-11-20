import { projectOntoSegment } from '../../../shared/geo/polyline';
import { toLatLng, type Coordinate } from '../../../shared/geo/types';

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
      const distance = projectOntoSegment(toLatLng(path[index]!), path[start]!, path[end]!).distanceMeters;
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
