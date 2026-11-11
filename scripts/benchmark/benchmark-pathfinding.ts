/**
 * Benchmark Dijkstra vs A* trên đồ thị OSM thật.
 *
 * Cách chạy (từ thư mục gốc):
 *   npm run benchmark:pathfinding                 # in kết quả ra màn hình
 *   npm run benchmark:pathfinding -- --write      # ghi thêm vào docs/BENCHMARK_PATHFINDING.md
 *   npm run benchmark:pathfinding -- --pairs=300  # số cặp điểm ngẫu nhiên (mặc định 200)
 *
 * Với mỗi cặp điểm, chạy cả hai thuật toán và kiểm tra chi phí BẰNG NHAU (A* phải tối ưu).
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AStarSolver } from '../../apps/api/src/modules/navigation/domain/algorithms/AStarSolver.js';
import { DijkstraSolver } from '../../apps/api/src/modules/navigation/domain/algorithms/DijkstraSolver.js';
import type {
  CostMetric,
  RoadGraph,
  Vehicle,
} from '../../apps/api/src/modules/navigation/domain/algorithms/RoadGraph.js';
import type { ShortestPathSolver } from '../../apps/api/src/modules/navigation/domain/algorithms/ShortestPathSolver.js';
import { OsmFileGraphSource } from '../../apps/api/src/modules/navigation/infrastructure/osm/OsmFileGraphSource.js';

const GRAPH_FILE = resolve('apps/api/data/osm/hcmc-center.json');
const REPORT_FILE = resolve('docs/BENCHMARK_PATHFINDING.md');

type Stats = { runs: number; visited: number; ms: number };

/** Bộ sinh số ngẫu nhiên có seed để mỗi lần chạy ra cùng một bộ cặp điểm (so sánh được). */
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

/** Chọn ngẫu nhiên các cặp node mà xe có thể xuất phát/đến được. */
function randomPairs(graph: RoadGraph, vehicle: Vehicle, count: number): [string, string][] {
  const random = seededRandom(42);
  const bbox = { south: 10.765, west: 106.685, north: 10.8, east: 106.725 };
  const randomPoint = () => ({
    lat: bbox.south + random() * (bbox.north - bbox.south),
    lng: bbox.west + random() * (bbox.east - bbox.west),
  });
  return Array.from({ length: count }, () => [
    graph.nearestNode(randomPoint(), vehicle)!.node.id,
    graph.nearestNode(randomPoint(), vehicle)!.node.id,
  ]);
}

function run(
  solver: ShortestPathSolver,
  graph: RoadGraph,
  pair: [string, string],
  vehicle: Vehicle,
  metric: CostMetric,
) {
  const started = performance.now();
  const result = solver.solve(graph, pair[0], pair[1], { vehicle, metric });
  return { result, ms: performance.now() - started };
}

async function main() {
  const pairCount = Number(process.argv.find((arg) => arg.startsWith('--pairs='))?.split('=')[1] ?? 200);
  const shouldWrite = process.argv.includes('--write');

  const loadStarted = performance.now();
  const { graph } = await new OsmFileGraphSource(GRAPH_FILE).load();
  const loadMs = performance.now() - loadStarted;

  const dijkstra = new DijkstraSolver();
  const astar = new AStarSolver();
  const rows: string[] = [];
  let mismatches = 0;

  for (const vehicle of ['motorcycle', 'car'] as const) {
    const pairs = randomPairs(graph, vehicle, pairCount);
    for (const metric of ['distance', 'duration'] as const) {
      const totals: Record<string, Stats> = {
        dijkstra: { runs: 0, visited: 0, ms: 0 },
        astar: { runs: 0, visited: 0, ms: 0 },
      };
      let unreachable = 0;
      for (const pair of pairs) {
        const d = run(dijkstra, graph, pair, vehicle, metric);
        const a = run(astar, graph, pair, vehicle, metric);
        if (!d.result || !a.result) {
          unreachable += 1; // không được xảy ra vì đã snap vào mạng đường chính
          continue;
        }
        if (Math.abs(d.result.cost - a.result.cost) > 1e-6 * Math.max(1, d.result.cost)) mismatches += 1;
        for (const [name, entry] of [
          ['dijkstra', d],
          ['astar', a],
        ] as const) {
          totals[name]!.runs += 1;
          totals[name]!.visited += entry.result!.visitedNodes;
          totals[name]!.ms += entry.ms;
        }
      }
      const avg = (name: string, key: 'visited' | 'ms') =>
        totals[name]![key] / Math.max(1, totals[name]!.runs);
      const visitedSaving = 100 * (1 - avg('astar', 'visited') / avg('dijkstra', 'visited'));
      rows.push(
        `| ${vehicle} | ${metric} | ${totals.dijkstra!.runs} | ${avg('dijkstra', 'visited').toFixed(0)} | ${avg('astar', 'visited').toFixed(0)} | ${visitedSaving.toFixed(0)}% | ${avg('dijkstra', 'ms').toFixed(2)} | ${avg('astar', 'ms').toFixed(2)} | ${unreachable} |`,
      );
    }
  }

  const report = [
    '# Benchmark Dijkstra vs A*',
    '',
    `- Dữ liệu: OpenStreetMap trung tâm TP.HCM (\`apps/api/data/osm/hcmc-center.json\`), ${graph.nodeCount} node, ${graph.edgeCount} cạnh có hướng.`,
    `- Thời gian nạp + dựng đồ thị: ${loadMs.toFixed(0)} ms. Mỗi cấu hình chạy ${pairCount} cặp điểm ngẫu nhiên (seed cố định).`,
    `- Máy chạy: ${process.platform} ${process.arch}, Node ${process.version}. Ngày chạy: ${new Date().toISOString().slice(0, 10)}.`,
    `- Số cặp có chi phí A* khác Dijkstra: **${mismatches}** (phải bằng 0 để chứng minh A* vẫn tối ưu).`,
    '',
    '| Xe | Tiêu chí | Số cặp | Node duyệt Dijkstra | Node duyệt A* | A* giảm | ms Dijkstra | ms A* | Không có đường |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '**Đọc kết quả:** "Node duyệt" là số node được lấy ra khỏi hàng đợi ưu tiên. A* dùng heuristic khoảng cách đường chim bay nên duyệt ít node hơn.',
    'Với tiêu chí thời gian, heuristic = khoảng cách / tốc độ lớn nhất của đồ thị nên yếu hơn, A* giảm ít hơn so với tiêu chí quãng đường.',
    '"Không có đường" phải bằng 0 vì điểm chỉ được snap vào mạng đường chính (thành phần liên thông mạnh lớn nhất).',
    '',
  ].join('\n');

  console.log(report);
  if (shouldWrite) {
    await writeFile(REPORT_FILE, report);
    console.log(`Đã ghi ${REPORT_FILE}`);
  }
  if (mismatches > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
