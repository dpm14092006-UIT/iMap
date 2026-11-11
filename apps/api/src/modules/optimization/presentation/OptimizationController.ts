import type { NextFunction, Request, Response } from 'express';
import type { OptimizeRouteUseCase } from '../application/OptimizeRouteUseCase.js';

/** HTTP cho tối ưu hành trình nhiều điểm. Validate nằm trong use case (trước khi gọi Matrix tính phí). */
export class OptimizationController {
  constructor(private readonly optimizeRoute: OptimizeRouteUseCase) {}

  /** POST /api/routes/optimize */
  optimize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await this.optimizeRoute.execute(req.body) });
    } catch (error) {
      next(error);
    }
  };
}
