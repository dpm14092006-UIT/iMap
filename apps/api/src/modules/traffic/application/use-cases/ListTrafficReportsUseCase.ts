import type { TrafficReportDto } from '@routetwin/shared';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
export class ListTrafficReportsUseCase {
  constructor(private readonly repository: TrafficReportRepository) {}
  async execute(): Promise<TrafficReportDto[]> {
    return (await this.repository.findAll()).map(report => report.toDto());
  }
}
