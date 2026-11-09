import type { TrafficReportInput, TrafficReportDto } from '@routetwin/shared';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
export class CreateTrafficReportUseCase {
  constructor(private readonly repository: TrafficReportRepository) {}
  execute(input: TrafficReportInput, accessToken: string): Promise<TrafficReportDto> {
    return this.repository.create(input, accessToken);
  }
}
