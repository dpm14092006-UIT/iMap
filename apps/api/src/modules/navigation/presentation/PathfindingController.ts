import type { NextFunction, Request, Response } from 'express';
import { pathfindingRequestSchema } from '@routetwin/shared';
import type { FindPathUseCase } from '../application/use-cases/FindPathUseCase.js';
import type { GetRoadGraphInfoUseCase } from '../application/use-cases/GetRoadGraphInfoUseCase.js';

/** HTTP cho thuật toán tìm đường tự cài đặt (Dijkstra / A*) trên đồ thị OSM. */
export class PathfindingController {
  constructor(
    private readonly findPath: FindPathUseCase,
    private readonly getGraphInfo: GetRoadGraphInfoUseCase,
  ) {}

  /** POST /api/routes/algorithm */
  solve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = pathfindingRequestSchema.parse(req.body);
      res.json({ data: await this.findPath.execute(request) });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/routes/algorithm/graph */
  graphInfo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await this.getGraphInfo.execute() });
    } catch (error) {
      next(error);
    }
  };
}
