import { randomUUID } from 'node:crypto';
import type { TrafficReportInput, TrafficReportDto } from '@routetwin/shared';
import { TrafficReport } from '../../domain/entities/TrafficReport.js';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
export class CreateTrafficReportUseCase {
  constructor(private readonly repository: TrafficReportRepository) {}
  async execute(input: TrafficReportInput): Promise<TrafficReportDto> {
    const report = new TrafficReport(randomUUID(), input, new Date());
    await this.repository.save(report);
    return report.toDto();
  }
}
