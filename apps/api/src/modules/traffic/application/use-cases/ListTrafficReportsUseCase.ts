import type { TrafficReportBounds, TrafficReportDto } from '@routetwin/shared';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
export class ListTrafficReportsUseCase {
  constructor(private readonly repository: TrafficReportRepository) {}
  execute(bounds: TrafficReportBounds, accessToken?: string): Promise<TrafficReportDto[]> {
    return this.repository.list(bounds, accessToken);
  }
}
