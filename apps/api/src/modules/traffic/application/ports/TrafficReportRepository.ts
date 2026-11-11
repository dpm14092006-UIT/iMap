import type { TrafficReportBounds, TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
export interface TrafficReportRepository {
  list(bounds: TrafficReportBounds, accessToken?: string): Promise<TrafficReportDto[]>;
  create(input: TrafficReportInput, accessToken: string): Promise<TrafficReportDto>;
  updateClearance(
    id: string,
    state: 'clear' | 'still_active',
    accessToken: string,
  ): Promise<TrafficReportDto>;
}
