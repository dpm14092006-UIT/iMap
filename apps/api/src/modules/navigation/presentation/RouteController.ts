import type { NextFunction, Request, Response } from 'express';
import { routeRequestSchema } from '@routetwin/shared';
import { getRequestId } from '../../../shared/http/request-context.js';
import type { CalculateRouteUseCase } from '../application/use-cases/CalculateRouteUseCase.js';

import type { RouteComparisonController } from './RouteComparisonController.js';

export class RouteController {
  constructor(
    private readonly calculateRoute: CalculateRouteUseCase,
    private readonly comparisons?: RouteComparisonController,
  ) {}

  calculate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = routeRequestSchema.parse(req.body);
      const { comparisonSessionId, ...routeRequest } = request;
      const result = await this.calculateRoute.execute(routeRequest, { requestId: getRequestId(req) });
      const comparison =
        comparisonSessionId && routeRequest.alternatives && routeRequest.points.length === 2
          ? this.comparisons?.snapshot(result, comparisonSessionId)
          : undefined;
      res.json({ data: comparison ? { ...result, comparison } : result });
    } catch (error) {
      next(error);
    }
  };
}
