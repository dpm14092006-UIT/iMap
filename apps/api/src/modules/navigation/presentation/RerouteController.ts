import type { NextFunction, Request, Response } from 'express';
import type { RerouteUseCase } from '../application/use-cases/RerouteUseCase.js';

/** HTTP cho tính lại tuyến (Dynamic Rerouting). Validate nằm trong use case. */
export class RerouteController {
  constructor(private readonly reroute: RerouteUseCase) {}

  /** POST /api/routes/reroute */
  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await this.reroute.execute(req.body) });
    } catch (error) {
      next(error);
    }
  };
}
