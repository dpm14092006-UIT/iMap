import type { TrafficReportDto } from '@routetwin/shared';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
export class UpdateRoadClearanceUseCase {
  constructor(private readonly repository: TrafficReportRepository) {}
  execute(id: string, state: 'clear' | 'still_active', accessToken: string): Promise<TrafficReportDto> {
    return this.repository.updateClearance(id, state, accessToken);
  }
}
