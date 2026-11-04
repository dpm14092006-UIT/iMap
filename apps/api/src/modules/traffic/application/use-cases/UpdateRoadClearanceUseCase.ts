import type { TrafficReportDto } from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
export class UpdateRoadClearanceUseCase {
  constructor(private readonly repository: TrafficReportRepository) {}
  async execute(id: string, state: 'clear' | 'still_active'): Promise<TrafficReportDto> {
    const report = await this.repository.findById(id);
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Không tìm thấy cảnh báo');
    state === 'clear' ? report.markCleared() : report.markStillActive();
    await this.repository.save(report);
    return report.toDto();
  }
}
