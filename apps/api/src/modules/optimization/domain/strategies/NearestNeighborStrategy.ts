import type { OptimizationStrategy } from './OptimizationStrategy.js';
/** Skeleton thuật toán: NN cho bài toán đường đi mở, giữ điểm 0 làm xuất phát. */
export class NearestNeighborStrategy implements OptimizationStrategy {
  optimize(matrix: number[][]): number[] {
    const n = matrix.length;
    if (!matrix.every((row) => row.length === n)) throw new Error('Ma trận không vuông');
    const order = n ? [0] : [];
    const remaining = new Set(Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1));
    while (remaining.size) {
      const from = order[order.length - 1]!;
      let best: number | null = null;
      for (const next of remaining)
        if (best === null || matrix[from]![next]! < matrix[from]![best]!) best = next;
      if (best === null || !Number.isFinite(matrix[from]![best]!))
        throw new Error('Không tìm thấy đường hợp lệ tới điểm còn lại');
      order.push(best);
      remaining.delete(best);
    }
    return order;
  }
}
