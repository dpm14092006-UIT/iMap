import type { NextFunction, Request, Response } from 'express';
import { routeRequestSchema } from '@routetwin/shared';
import { getRequestId } from '../../../shared/http/request-context.js';
import type { CalculateRouteUseCase } from '../application/use-cases/CalculateRouteUseCase.js';

export class RouteController {
  constructor(private readonly calculateRoute: CalculateRouteUseCase) {}

  calculate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = routeRequestSchema.parse(req.body);
      res.json({ data: await this.calculateRoute.execute(request, { requestId: getRequestId(req) }) });
    } catch (error) {
      next(error);
    }
  };
}
