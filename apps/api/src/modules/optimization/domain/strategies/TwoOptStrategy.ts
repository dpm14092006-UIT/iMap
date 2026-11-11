import { assertValidMatrix, inputOrder, tourCost } from '../tour.js';
import { NearestNeighborStrategy } from './NearestNeighborStrategy.js';
import type { OptimizationStrategy, TourResult } from './OptimizationStrategy.js';

/** Bỏ qua cải thiện quá nhỏ do sai số số thực. */
const EPSILON = 1e-9;
/** Giới hạn số vòng cải thiện để luôn dừng (thực tế hội tụ sau vài vòng). */
const MAX_ROUNDS = 1000;

/**
 * NN + 2-opt (heuristic): lấy lời giải tham lam rồi cải thiện dần.
 *
 * Mỗi bước 2-opt chọn một đoạn giữa hành trình và ĐẢO NGƯỢC thứ tự đoạn đó,
 * giữ lại nếu tổng chi phí giảm. Lặp đến khi không cải thiện được nữa.
 *
 * Vì ma trận CÓ HƯỚNG (đường một chiều), đảo đoạn làm đổi chiều mọi cạnh bên trong,
 * nên không dùng công thức "chỉ tính 2 cạnh đổi" của TSP đối xứng mà TÍNH LẠI toàn bộ chi phí.
 * Với ≤ 16 điểm, mỗi lần tính O(n) vẫn rất nhanh.
 *
 * Không đảm bảo tối ưu, nhưng chạy được với nhiều điểm hơn Held–Karp (O(n²·2ⁿ)).
 */
export class TwoOptStrategy implements OptimizationStrategy {
  readonly name = 'two-opt';

  constructor(private readonly initial: OptimizationStrategy = new NearestNeighborStrategy()) {}

  optimize(matrix: number[][], returnToStart = false): TourResult {
    assertValidMatrix(matrix);
    let { order, cost } = this.initial.optimize(matrix, returnToStart);

    // Vùng được phép đảo: bỏ điểm xuất phát ở đầu (và ở cuối nếu khép kín).
    const first = 1;
    const last = returnToStart ? order.length - 2 : order.length - 1;

    // Best-improvement: mỗi vòng thử MỌI cách đảo đoạn [i..k], chỉ áp dụng cách giảm chi phí nhiều nhất.
    // (Nhận ngay cải thiện đầu tiên dễ kẹt ở lời giải kém hơn.)
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let bestOrder: number[] | null = null;
      let bestCost = cost;
      for (let i = first; i < last; i++) {
        for (let k = i + 1; k <= last; k++) {
          const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
          const candidateCost = tourCost(matrix, candidate);
          if (candidateCost < bestCost - EPSILON) {
            bestOrder = candidate;
            bestCost = candidateCost;
          }
        }
      }
      if (!bestOrder) break; // không còn cách đảo nào tốt hơn: đã tới tối ưu cục bộ
      order = bestOrder;
      cost = bestCost;
    }

    // Giống ExactTourStrategy: nếu thứ tự người dùng nhập không tệ hơn thì giữ nguyên, tránh đảo lộn vô ích.
    const original = inputOrder(matrix.length, returnToStart);
    const originalCost = tourCost(matrix, original);
    return originalCost <= cost ? { order: original, cost: originalCost } : { order, cost };
  }
}
