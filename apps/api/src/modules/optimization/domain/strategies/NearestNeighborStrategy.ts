import { assertValidMatrix, tourCost } from '../tour.js';
import type { OptimizationStrategy, TourResult } from './OptimizationStrategy.js';

/**
 * Nearest Neighbor (tham lam): từ điểm hiện tại luôn đi tới điểm CHƯA GHÉ gần nhất.
 * Rất nhanh, O(n²), nhưng không đảm bảo tối ưu — dùng làm lời giải ban đầu cho 2-opt.
 * Điểm 0 (xuất phát) luôn đứng đầu.
 */
export class NearestNeighborStrategy implements OptimizationStrategy {
  readonly name = 'nearest-neighbor';

  optimize(matrix: number[][], returnToStart = false): TourResult {
    assertValidMatrix(matrix);
    const order = [0];
    const remaining = new Set(Array.from({ length: matrix.length - 1 }, (_, i) => i + 1));

    while (remaining.size > 0) {
      const from = order[order.length - 1]!;
      let best: number | null = null;
      for (const next of remaining) {
        if (best === null || matrix[from]![next]! < matrix[from]![best]!) best = next;
      }
      if (best === null || !Number.isFinite(matrix[from]![best]!)) throw new Error('Không tìm thấy đường hợp lệ tới điểm còn lại.');
      order.push(best);
      remaining.delete(best);
    }

    if (returnToStart) order.push(0);
    const cost = tourCost(matrix, order);
    if (!Number.isFinite(cost)) throw new Error('Không có đường quay về điểm xuất phát.');
    return { order, cost };
  }
}
