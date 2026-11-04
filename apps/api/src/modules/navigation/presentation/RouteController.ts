import type { NextFunction, Request, Response } from 'express';
import { routeRequestSchema } from '@routetwin/shared';
import type { CalculateRouteUseCase } from '../application/use-cases/CalculateRouteUseCase.js';

export class RouteController {
  constructor(private readonly calculateRoute: CalculateRouteUseCase) {}

  calculate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = routeRequestSchema.parse(req.body);
      res.json({ data: await this.calculateRoute.execute(request) });
    } catch (error) {
      next(error);
    }
  };
}
