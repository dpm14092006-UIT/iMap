import type { TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
export class TrafficReport {
  private status: 'active' | 'cleared' = 'active';
  constructor(
    public readonly id: string,
    public readonly input: TrafficReportInput,
    public readonly createdAt: Date,
  ) {}
  markCleared(): void { this.status = 'cleared'; }
  markStillActive(): void { this.status = 'active'; }
  toDto(): TrafficReportDto {
    return { id: this.id, ...this.input, status: this.status, createdAt: this.createdAt.toISOString() };
  }
}
