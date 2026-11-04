import type { Request, Response } from 'express';
import { clearanceSchema, trafficBoundsSchema, trafficReportIdSchema, trafficReportInputSchema } from '@routetwin/shared';
import type { AuthenticatedRequest } from '../../../shared/http/authenticated-request.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { CreateTrafficReportUseCase } from '../application/use-cases/CreateTrafficReportUseCase.js';
import { ListTrafficReportsUseCase } from '../application/use-cases/ListTrafficReportsUseCase.js';
import { UpdateRoadClearanceUseCase } from '../application/use-cases/UpdateRoadClearanceUseCase.js';
export class TrafficController {
  constructor(
    private readonly createReport: CreateTrafficReportUseCase,
    private readonly listReports: ListTrafficReportsUseCase,
    private readonly clearance: UpdateRoadClearanceUseCase,
  ) {}
  list = async (req: Request, res: Response): Promise<void> => {
    const bounds = this.parseBounds(req);
    const accessToken = req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    res.json({ data: await this.listReports.execute(bounds, accessToken) });
  };
  geojson = async (req: Request, res: Response): Promise<void> => {
    const bounds = this.parseBounds(req);
    const accessToken = req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const reports = await this.listReports.execute(bounds, accessToken);
    res.json({ data: {
      type: 'FeatureCollection',
      features: reports.map((report) => ({
        type: 'Feature',
        id: report.id,
        geometry: { type: 'Point', coordinates: [report.lng, report.lat] },
        properties: {
          incidentType: report.incidentType,
          severity: report.severity,
          status: report.status,
          ...(report.note ? { note: report.note } : {}),
          createdAt: report.createdAt,
          expiresAt: report.expiresAt,
          version: report.version,
        },
      })),
    } });
  };
  create = async (req: Request, res: Response): Promise<void> => {
    const input = trafficReportInputSchema.parse(req.body);
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để gửi báo cáo');
    res.status(201).json({ data: await this.createReport.execute(input, auth.accessToken) });
  };
  updateClearance = async (req: Request, res: Response): Promise<void> => {
    const input = clearanceSchema.parse(req.body);
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để xác minh báo cáo');
    const id = trafficReportIdSchema.parse(String(req.params.id));
    res.json({ data: await this.clearance.execute(id, input.state, auth.accessToken) });
  };

  private parseBounds(req: Request) {
    return trafficBoundsSchema.parse({
      minLat: req.query.minLat,
      minLng: req.query.minLng,
      maxLat: req.query.maxLat,
      maxLng: req.query.maxLng,
    });
  }
}
