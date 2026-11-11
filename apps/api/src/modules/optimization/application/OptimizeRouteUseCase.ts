import {
  optimizeRouteRequestSchema,
  type OptimizeRouteRequest,
  type OptimizeRouteResult,
} from '@routetwin/shared';
import { AppError } from '../../../shared/errors/AppError.js';
import type { RouteProvider } from '../../navigation/domain/ports/RouteProvider.js';
import type { MatrixProvider } from '../domain/ports/MatrixProvider.js';
import { ExactTourStrategy } from '../domain/strategies/ExactTourStrategy.js';
import type {
  OptimizationStrategy,
  TourAlgorithm,
  TourResult,
} from '../domain/strategies/OptimizationStrategy.js';
import { TwoOptStrategy } from '../domain/strategies/TwoOptStrategy.js';
import { findIsolatedPoints, inputOrder, tourCost } from '../domain/tour.js';

/** Thuật toán cho từng nhóm; có thể thay bằng chiến lược khác mà không sửa use case. */
export type TourStrategies = Record<TourAlgorithm, OptimizationStrategy>;

const defaultStrategies: TourStrategies = { exact: new ExactTourStrategy(), heuristic: new TwoOptStrategy() };

/**
 * Sắp xếp thứ tự ghé tốt nhất cho hành trình nhiều điểm:
 * 1. Lấy ma trận chi phí đường bộ có hướng (VietMap Matrix).
 * 2. Chọn thuật toán: Held–Karp (chính xác, mặc định) hoặc NN + 2-opt (gần đúng, khi người dùng chọn "Nhanh").
 * 3. Tính tuyến thật qua các điểm theo thứ tự mới (VietMap Route), không nối thẳng.
 */
export class OptimizeRouteUseCase {
  constructor(
    private readonly matrices: MatrixProvider,
    private readonly routes: RouteProvider,
    private readonly strategies: TourStrategies = defaultStrategies,
  ) {}

  async execute(raw: OptimizeRouteRequest): Promise<OptimizeRouteResult> {
    // Kiểm tra (trùng điểm, quá nhiều điểm…) TRƯỚC khi gọi Matrix tính phí.
    const input = optimizeRouteRequestSchema.parse(raw);
    const algorithm = this.chooseAlgorithm(input.algorithm, input.points.length);
    const matrix = await this.matrices.getCosts(input);
    this.assertNoIsolatedPoints(matrix, input.returnToStart);

    let tour: TourResult;
    try {
      tour = this.strategies[algorithm].optimize(matrix, input.returnToStart);
    } catch {
      throw new AppError(
        422,
        'TOUR_UNREACHABLE',
        'Không có hành trình nối đủ các điểm. Hãy kiểm tra vị trí và phương tiện.',
      );
    }

    const originalCost = tourCost(matrix, inputOrder(input.points.length, input.returnToStart));
    const route = await this.routes.calculate({
      points: tour.order.map((i) => input.points[i]!),
      vehicle: input.vehicle,
      objective: input.objective,
    });
    return {
      order: tour.order,
      route,
      originalCost: Number.isFinite(originalCost) ? originalCost : null,
      optimizedCost: tour.cost,
      objective: input.objective,
      algorithm,
    };
  }

  /** Báo rõ ĐIỂM NÀO không có đường (thay vì lỗi chung chung), để người dùng sửa đúng chỗ. */
  private assertNoIsolatedPoints(matrix: number[][], returnToStart: boolean): void {
    const isolated = findIsolatedPoints(matrix, returnToStart);
    if (isolated.length === 0) return;
    // Index 0 là điểm xuất phát; index i ≥ 1 là "điểm ghé số i" theo thứ tự người dùng nhập.
    const labels = isolated
      .map((index) => (index === 0 ? 'điểm xuất phát' : `điểm ghé số ${index}`))
      .join(', ');
    // Giữ mã lỗi TOUR_UNREACHABLE như trước để không đổi hợp đồng API; chỉ thông báo cụ thể hơn.
    throw new AppError(
      422,
      'TOUR_UNREACHABLE',
      `Không có đường xe đi tới hoặc rời khỏi ${labels} (có thể nằm trong khu đi bộ hoặc công viên). Hãy chọn vị trí sát đường hơn.`,
    );
  }

  /** "auto" dùng Held–Karp khi đủ ít điểm để chạy nhanh, ngược lại dùng heuristic. */
  private chooseAlgorithm(requested: OptimizeRouteRequest['algorithm'], pointCount: number): TourAlgorithm {
    const exactFits = pointCount <= ExactTourStrategy.MAX_POINTS;
    if (requested === 'exact' && !exactFits) {
      throw new AppError(
        422,
        'TOO_MANY_POINTS_FOR_EXACT',
        `Thuật toán chính xác chỉ hỗ trợ tối đa ${ExactTourStrategy.MAX_POINTS - 1} điểm ghé. Hãy chọn "Tự động" hoặc "Nhanh".`,
      );
    }
    if (requested === 'auto') return exactFits ? 'exact' : 'heuristic';
    return requested;
  }
}
