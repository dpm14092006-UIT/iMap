import type { TrafficReportRepository } from '../../application/ports/TrafficReportRepository.js';
import { TrafficReport } from '../../domain/entities/TrafficReport.js';
import { randomUUID } from 'node:crypto';
import type { TrafficReportBounds, TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
/** Local/test adapter; production composition injects the Supabase repository. */
export class InMemoryTrafficReportRepository implements TrafficReportRepository {
  private readonly reports = new Map<string, TrafficReport>();
  async list(bounds: TrafficReportBounds, _accessToken?: string): Promise<TrafficReportDto[]> {
    return [...this.reports.values()]
      .filter(
        (report) =>
          !report.isExpired() &&
          report.input.lat >= bounds.minLat &&
          report.input.lat <= bounds.maxLat &&
          report.input.lng >= bounds.minLng &&
          report.input.lng <= bounds.maxLng,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 200)
      .map((report) => report.toDto());
  }
  async create(input: TrafficReportInput, _accessToken: string): Promise<TrafficReportDto> {
    const report = new TrafficReport(randomUUID(), input, new Date());
    this.reports.set(report.id, report);
    return report.toDto();
  }
  async updateClearance(
    id: string,
    state: 'clear' | 'still_active',
    _accessToken: string,
  ): Promise<TrafficReportDto> {
    const report = this.reports.get(id);
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Không tìm thấy cảnh báo');
    if (report.isExpired()) throw new AppError(410, 'REPORT_EXPIRED', 'Báo cáo này đã hết hạn');
    if (state === 'clear') report.markCleared();
    else report.markStillActive();
    return report.toDto();
  }
}
