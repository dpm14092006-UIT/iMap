import {
  optimizeRouteRequestSchema,
  type OptimizeRouteRequest,
  type OptimizeRouteResult,
} from '@routetwin/shared';
import type { RouteProvider } from '../../navigation/domain/ports/RouteProvider.js';
import type { MatrixProvider } from '../domain/ports/MatrixProvider.js';
import { ExactTourStrategy } from '../domain/strategies/ExactTourStrategy.js';
import { AppError } from '../../../shared/errors/AppError.js';
export class OptimizeRouteUseCase {
  constructor(
    private readonly matrices: MatrixProvider,
    private readonly routes: RouteProvider,
  ) {}
  async execute(raw: OptimizeRouteRequest): Promise<OptimizeRouteResult> {
    const input = optimizeRouteRequestSchema.parse(raw);
    const matrix = await this.matrices.getCosts(input);
    let tour: { order: number[]; cost: number };
    try {
      tour = new ExactTourStrategy().optimize(matrix, input.returnToStart);
    } catch {
      throw new AppError(
        422,
        'TOUR_UNREACHABLE',
        'Không có hành trình nối đủ các điểm. Hãy kiểm tra vị trí và phương tiện.',
      );
    }
    const baseline = [0, ...input.points.slice(1).map((_, i) => i + 1), ...(input.returnToStart ? [0] : [])];
    const originalCost = baseline.slice(1).reduce((sum, to, i) => sum + matrix[baseline[i]!]![to]!, 0);
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
    };
  }
}
