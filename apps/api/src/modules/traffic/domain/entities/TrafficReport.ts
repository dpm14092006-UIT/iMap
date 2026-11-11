import type { TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
export class TrafficReport {
  private status: 'active' | 'cleared' = 'active';
  private version = 1;
  public readonly expiresAt: Date;
  constructor(
    public readonly id: string,
    public readonly input: TrafficReportInput,
    public readonly createdAt: Date,
    expiresAt?: Date,
  ) {
    const lifetimeMs = input.incidentType === 'accident' || input.incidentType === 'road_closure' ? 12 : 4;
    this.expiresAt = expiresAt ?? new Date(createdAt.getTime() + lifetimeMs * 60 * 60 * 1000);
  }
  markCleared(): void {
    this.status = 'cleared';
    this.version += 1;
  }
  markStillActive(): void {
    this.status = 'active';
    this.version += 1;
  }
  isExpired(now = new Date()): boolean {
    return this.expiresAt <= now;
  }
  toDto(): TrafficReportDto {
    return {
      id: this.id,
      ...this.input,
      status: this.isExpired() ? 'expired' : this.status,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      version: this.version,
    };
  }
}
