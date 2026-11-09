import type { Request, Response } from 'express';
import { clearanceSchema, trafficBoundsSchema, trafficImageAnalysisTaskSchema, trafficReportIdSchema, trafficReportInputSchema } from '@routetwin/shared';
import type { AuthenticatedRequest } from '../../../shared/http/authenticated-request.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { CreateTrafficReportUseCase } from '../application/use-cases/CreateTrafficReportUseCase.js';
import { ListTrafficReportsUseCase } from '../application/use-cases/ListTrafficReportsUseCase.js';
import { UpdateRoadClearanceUseCase } from '../application/use-cases/UpdateRoadClearanceUseCase.js';
import { AnalyzeTrafficImageUseCase } from '../application/use-cases/AnalyzeTrafficImageUseCase.js';
import type { TrafficImageMimeType } from '../application/ports/TrafficImageAnalyzer.js';

const maxTrafficImageBytes = 5 * 1024 * 1024;
const allowedImageMimeTypes = new Set<TrafficImageMimeType>(['image/jpeg', 'image/png', 'image/webp']);

export class TrafficController {
  constructor(
    private readonly createReport: CreateTrafficReportUseCase,
    private readonly listReports: ListTrafficReportsUseCase,
    private readonly clearance: UpdateRoadClearanceUseCase,
    private readonly analyzeImageUseCase: AnalyzeTrafficImageUseCase,
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
          hasPhoto: Boolean(report.imagePath),
          communityReportCount: report.communityReportCount ?? 1,
          communityReporterCount: report.communityReporterCount ?? 0,
          communityUpdatedAt: report.communityUpdatedAt ?? null,
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
  analyzeImage = async (req: Request, res: Response): Promise<void> => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để phân tích ảnh');
    const task = trafficImageAnalysisTaskSchema.parse(req.query.task);
    const mimeType = req.header('content-type')?.split(';', 1)[0]?.trim();
    if (!mimeType || !allowedImageMimeTypes.has(mimeType as TrafficImageMimeType)) {
      throw new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Ảnh phải là JPG, PNG hoặc WebP.');
    }
    const image = req.body;
    if (!Buffer.isBuffer(image) || image.length === 0 || image.length > maxTrafficImageBytes) {
      throw new AppError(400, 'INVALID_IMAGE', 'Không đọc được ảnh hoặc ảnh vượt quá 5 MB.');
    }
    if (!this.matchesImageSignature(image, mimeType as TrafficImageMimeType)) {
      throw new AppError(415, 'INVALID_IMAGE_CONTENT', 'Nội dung ảnh không khớp với định dạng tệp.');
    }
    res.json({ data: await this.analyzeImageUseCase.execute(image, mimeType as TrafficImageMimeType, task) });
  };

  private parseBounds(req: Request) {
    return trafficBoundsSchema.parse({
      minLat: req.query.minLat,
      minLng: req.query.minLng,
      maxLat: req.query.maxLat,
      maxLng: req.query.maxLng,
    });
  }

  private matchesImageSignature(image: Buffer, mimeType: TrafficImageMimeType): boolean {
    if (mimeType === 'image/jpeg') return image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    if (mimeType === 'image/png') return image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return image.length >= 12 && image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
  }
}
