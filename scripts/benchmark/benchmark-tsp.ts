/**
 * Benchmark sắp xếp điểm ghé: Held–Karp (chính xác) vs Nearest Neighbor vs NN + 2-opt (gần đúng), 3–15 điểm ghé.
 *
 * Cách chạy (từ thư mục gốc):
 *   npm run benchmark:tsp               # in kết quả ra màn hình
 *   npm run benchmark:tsp -- --write    # ghi thêm vào docs/BENCHMARK_TSP.md
 *
 * Dùng ma trận GIẢ LẬP (không gọi VietMap để khỏi tốn hạn mức): điểm ngẫu nhiên trong trung tâm TP.HCM,
 * chi phí = khoảng cách đường chim bay × hệ số đường vòng ngẫu nhiên THEO TỪNG CHIỀU (mô phỏng đường một chiều).
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { haversineMeters } from '../../apps/api/src/shared/geo/haversine.js';
import { ExactTourStrategy } from '../../apps/api/src/modules/optimization/domain/strategies/ExactTourStrategy.js';
import { NearestNeighborStrategy } from '../../apps/api/src/modules/optimization/domain/strategies/NearestNeighborStrategy.js';
import type { OptimizationStrategy } from '../../apps/api/src/modules/optimization/domain/strategies/OptimizationStrategy.js';
import { TwoOptStrategy } from '../../apps/api/src/modules/optimization/domain/strategies/TwoOptStrategy.js';

const REPORT_FILE = resolve('docs/BENCHMARK_TSP.md');
const INSTANCES = 200;

/** Bộ sinh số ngẫu nhiên có seed để mỗi lần chạy ra cùng bộ dữ liệu. */
function seededRandom(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
}

/** Ma trận khoảng cách có hướng (mét) cho `size` điểm ngẫu nhiên. */
function syntheticMatrix(size: number, random: () => number): number[][] {
  const points = Array.from({ length: size }, () => ({
    lat: 10.765 + random() * 0.035,
    lng: 106.685 + random() * 0.04,
  }));
  // Hệ số đường vòng 1.2–1.8: đường thật luôn dài hơn đường chim bay, mỗi chiều một khác.
  return points.map((a, i) =>
    points.map((b, j) => (i === j ? 0 : Math.round(haversineMeters(a, b) * (1.2 + random() * 0.6)))),
  );
}

function timed(strategy: OptimizationStrategy, matrix: number[][]) {
  const started = performance.now();
  const { cost } = strategy.optimize(matrix);
  return { cost, ms: performance.now() - started };
}

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const format = (value: number, digits = 2) => value.toFixed(digits);

async function main() {
  const exact = new ExactTourStrategy();
  const nearestNeighbor = new NearestNeighborStrategy();
  const twoOpt = new TwoOptStrategy();

  // Với mỗi số điểm ghé: so NN và NN + 2-opt với lời giải tối ưu của Held–Karp.
  const rows: string[] = [];
  for (let stops = 3; stops <= ExactTourStrategy.MAX_POINTS - 1; stops++) {
    const random = seededRandom(1000 + stops);
    const nnGaps: number[] = [],
      twoOptGaps: number[] = [];
    const exactMs: number[] = [],
      twoOptMs: number[] = [];
    let twoOptOptimal = 0;
    for (let instance = 0; instance < INSTANCES; instance++) {
      const matrix = syntheticMatrix(stops + 1, random);
      const best = timed(exact, matrix),
        nn = timed(nearestNeighbor, matrix),
        improved = timed(twoOpt, matrix);
      nnGaps.push(100 * (nn.cost / best.cost - 1));
      twoOptGaps.push(100 * (improved.cost / best.cost - 1));
      if (improved.cost === best.cost) twoOptOptimal += 1;
      exactMs.push(best.ms);
      twoOptMs.push(improved.ms);
    }
    rows.push(
      `| ${stops} | ${format(average(nnGaps), 1)}% | ${format(average(twoOptGaps), 1)}% | ${format(Math.max(...twoOptGaps), 1)}% | ${Math.round((100 * twoOptOptimal) / INSTANCES)}% | ${format(average(exactMs), 2)} | ${format(average(twoOptMs), 3)} |`,
    );
    console.error(`  xong ${stops} điểm ghé`);
  }

  const report = [
    '# Benchmark sắp xếp điểm ghé (TSP đường đi mở)',
    '',
    `- ${INSTANCES} bộ dữ liệu mỗi dòng; ma trận có hướng giả lập trong trung tâm TP.HCM (đường chim bay × hệ số đường vòng 1,2–1,8 theo từng chiều).`,
    '- Điểm xuất phát cố định, điểm cuối tự do (giống chế độ mặc định của app). "Dài hơn tối ưu" so với lời giải chính xác của Held–Karp.',
    `- Máy chạy: ${process.platform} ${process.arch}, Node ${process.version}. Ngày chạy: ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '| Điểm ghé | NN dài hơn tối ưu (TB) | NN + 2-opt dài hơn tối ưu (TB) | 2-opt tệ nhất | 2-opt ra đúng tối ưu | ms Held–Karp | ms 2-opt |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '**Đọc kết quả:**',
    '- Held–Karp luôn cho lời giải tối ưu; thời gian tăng theo O(n²·2ⁿ) — gần gấp đôi mỗi khi thêm 1 điểm, nhưng vẫn chỉ vài chục ms ở 15 điểm ghé.',
    '  Vì vậy app dùng Held–Karp cho chế độ "Tự động" trong toàn bộ giới hạn 15 điểm ghé.',
    '- Nearest Neighbor (tham lam) dài hơn tối ưu vài phần trăm và tệ dần khi nhiều điểm; thêm 2-opt kéo sai lệch trung bình xuống còn khoảng 1–3%,',
    '  nhưng không đảm bảo tối ưu (cột "2-opt tệ nhất"). 2-opt nhanh hơn Held–Karp nhiều lần và tăng chậm (đa thức), nên phù hợp khi số điểm vượt giới hạn của Held–Karp.',
    '',
  ].join('\n');

  console.log(report);
  if (process.argv.includes('--write')) {
    await writeFile(REPORT_FILE, report);
    console.log(`Đã ghi ${REPORT_FILE}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
