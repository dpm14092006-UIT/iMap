import type { Coordinate } from '../types';

const MAX_VERTICES = 240;
const CANDIDATES = 48;
const METERS_PER_DEGREE = 111_320;

type Flat = { x: number; y: number };

function decimate(path: Coordinate[]): Coordinate[] {
  if (path.length <= MAX_VERTICES) return path;
  const step = (path.length - 1) / (MAX_VERTICES - 1);
  return Array.from({ length: MAX_VERTICES }, (_, i) => path[Math.round(i * step)]!);
}

function distanceToPolyline(point: Flat, line: Flat[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
  }
  return line.length === 1 ? Math.hypot(point.x - line[0]!.x, point.y - line[0]!.y) : best;
}

/**
 * Chọn vị trí đặt nhãn cho từng tuyến: điểm trên tuyến xa các tuyến còn lại nhất (mét), để nhãn
 * không chồng lên nhau hay đè lên tuyến khác. Hai nhãn luôn cách nhau tối thiểu ~20% kích thước vùng tuyến. Tuyến duy nhất
 * thì đặt giữa tuyến. Trả về toạ độ [lat, lng] theo đúng thứ tự `paths`.
 */
export function pickRouteLabelPoints(paths: Coordinate[][]): Coordinate[] {
  const refLat = paths.flat()[0]?.[0] ?? 0;
  const cos = Math.cos((refLat * Math.PI) / 180);
  const flatten = (path: Coordinate[]): Flat[] =>
    decimate(path).map(([lat, lng]) => ({ x: lng * METERS_PER_DEGREE * cos, y: lat * METERS_PER_DEGREE }));
  const lines = paths.map(flatten);
  const placed: Flat[] = [];
  const all = lines.flat();
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  // Khoảng cách tối thiểu giữa hai nhãn ~ bề rộng một nhãn trên màn hình (~20% cạnh dài của vùng tuyến).
  const separation =
    all.length === 0 ? 0 : 0.2 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

  return paths.map((path, index) => {
    const line = lines[index]!;
    if (path.length === 0) return [0, 0] as Coordinate;
    if (path.length < 3 || lines.length < 2) return path[Math.floor(path.length / 2)]!;
    const others = lines.filter((_, other) => other !== index);
    let best = { valid: false, score: -Infinity, at: Math.floor(line.length / 2) };
    for (let c = 0; c < CANDIDATES; c++) {
      // Chừa 8% hai đầu tuyến (gần marker A/B).
      const at = Math.round((0.08 + (0.84 * c) / (CANDIDATES - 1)) * (line.length - 1));
      const point = line[at]!;
      const fromRoutes = Math.min(...others.map((other) => distanceToPolyline(point, other)));
      const fromLabels = placed.length
        ? Math.min(...placed.map((p) => Math.hypot(p.x - point.x, p.y - point.y)))
        : Infinity;
      // Ưu tiên 1: không sát nhãn đã đặt. Ưu tiên 2: xa các tuyến khác nhất.
      const valid = fromLabels >= separation;
      const score = valid ? fromRoutes : fromLabels;
      if ((valid && !best.valid) || (valid === best.valid && score > best.score)) best = { valid, score, at };
    }
    placed.push(line[best.at]!);
    // Lấy lại toạ độ gốc theo chỉ số đã decimate.
    return decimate(path)[best.at]!;
  });
}
