import type { TrafficReportRepository } from '../../application/ports/TrafficReportRepository.js';
import type { TrafficReport } from '../../domain/entities/TrafficReport.js';
/** Demo only: dữ liệu sẽ mất khi restart server; thay bằng Supabase repository ở P0. */
export class InMemoryTrafficReportRepository implements TrafficReportRepository {
  private readonly reports = new Map<string, TrafficReport>();
  async save(report: TrafficReport): Promise<void> { this.reports.set(report.id, report); }
  async findAll(): Promise<TrafficReport[]> {
    return [...this.reports.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async findById(id: string): Promise<TrafficReport | null> { return this.reports.get(id) ?? null; }
}
