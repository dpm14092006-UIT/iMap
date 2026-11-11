import { MAX_OPTIMIZE_POINTS } from '@routetwin/shared';
import { assertValidMatrix, inputOrder, tourCost } from '../tour.js';
import type { OptimizationStrategy, TourResult } from './OptimizationStrategy.js';

/**
 * Held–Karp (quy hoạch động) trên ma trận chi phí có hướng: cho lời giải TỐI ƯU CHÍNH XÁC.
 * Độ phức tạp O(n²·2ⁿ): đo thực tế 16 điểm (xuất phát + 15 điểm ghé) ≈ 35 ms,
 * nên giới hạn dùng chung với API (`MAX_OPTIMIZE_POINTS`) — một hằng số duy nhất, không khai báo hai nơi.
 * Departure is always index 0; open tours have a free final stop.
 */
export class ExactTourStrategy implements OptimizationStrategy {
  readonly name = 'held-karp';
  /** Số điểm tối đa (kể cả điểm xuất phát) mà Held–Karp vẫn chạy nhanh; bằng giới hạn của schema API. */
  static readonly MAX_POINTS = MAX_OPTIMIZE_POINTS;

  optimize(matrix: number[][], returnToStart = false): TourResult {
    const n = matrix.length;
    if (n > ExactTourStrategy.MAX_POINTS) throw new Error('Ma trận chi phí không hợp lệ.');
    assertValidMatrix(matrix);

    // dp[mask * m + j]: chi phí nhỏ nhất xuất phát từ 0, ghé đúng các điểm trong `mask`, kết thúc ở điểm j.
    // Dùng mảng typed phẳng thay cho mảng lồng nhau: nhanh hơn và ít bộ nhớ hơn nhiều.
    const m = n - 1;
    const size = 1 << m;
    const dp = new Float64Array(size * m).fill(Infinity);
    const parent = new Int8Array(size * m).fill(-1);
    for (let j = 0; j < m; j++) dp[(1 << j) * m + j] = matrix[0]![j + 1]!;
    for (let mask = 1; mask < size; mask++) {
      for (let j = 0; j < m; j++) {
        const current = dp[mask * m + j]!;
        if (!(mask & (1 << j)) || !Number.isFinite(current)) continue;
        for (let k = 0; k < m; k++) {
          if (mask & (1 << k)) continue;
          const slot = (mask | (1 << k)) * m + k;
          const cost = current + matrix[j + 1]![k + 1]!;
          if (cost < dp[slot]!) {
            dp[slot] = cost;
            parent[slot] = j;
          }
        }
      }
    }

    let best = Infinity;
    let last = -1;
    for (let j = 0; j < m; j++) {
      const cost = dp[(size - 1) * m + j]! + (returnToStart ? matrix[j + 1]![0]! : 0);
      if (cost < best) {
        best = cost;
        last = j;
      }
    }
    if (last === -1) throw new Error('Không có hành trình đi qua tất cả điểm đã chọn.');

    const reversed: number[] = [];
    let mask = size - 1;
    while (last !== -1) {
      reversed.push(last + 1);
      const previous = parent[mask * m + last]!;
      mask ^= 1 << last;
      last = previous;
    }
    const order = [0, ...reversed.reverse(), ...(returnToStart ? [0] : [])];
    // Chi phí bằng nhau thì giữ thứ tự người dùng nhập để không đảo thứ tự một cách khó hiểu.
    const baseline = inputOrder(n, returnToStart);
    const baselineCost = tourCost(matrix, baseline);
    return baselineCost <= best ? { order: baseline, cost: baselineCost } : { order, cost: best };
  }
}
