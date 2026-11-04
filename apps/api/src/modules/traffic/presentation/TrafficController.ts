import type { Request, Response } from 'express';
import { clearanceSchema, trafficReportInputSchema } from '@routetwin/shared';
import { CreateTrafficReportUseCase } from '../application/use-cases/CreateTrafficReportUseCase.js';
import { ListTrafficReportsUseCase } from '../application/use-cases/ListTrafficReportsUseCase.js';
import { UpdateRoadClearanceUseCase } from '../application/use-cases/UpdateRoadClearanceUseCase.js';
export class TrafficController {
  constructor(
    private readonly createReport: CreateTrafficReportUseCase,
    private readonly listReports: ListTrafficReportsUseCase,
    private readonly clearance: UpdateRoadClearanceUseCase,
  ) {}
  list = async (_req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.listReports.execute() });
  };
  create = async (req: Request, res: Response): Promise<void> => {
    const input = trafficReportInputSchema.parse(req.body);
    res.status(201).json({ data: await this.createReport.execute(input) });
  };
  updateClearance = async (req: Request, res: Response): Promise<void> => {
    const input = clearanceSchema.parse(req.body);
    res.json({ data: await this.clearance.execute(String(req.params.id), input.state) });
  };
}
