import type { RouteRequest, RouteResult } from '@routetwin/shared';
import type { RouteProvider } from '../../domain/ports/RouteProvider.js';
export class CalculateRouteUseCase {
  constructor(private readonly provider: RouteProvider) {}
  execute(request: RouteRequest): Promise<RouteResult> { return this.provider.calculate(request); }
}
