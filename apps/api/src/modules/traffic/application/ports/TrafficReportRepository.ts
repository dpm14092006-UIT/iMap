import type { TrafficReport } from '../../domain/entities/TrafficReport.js';
export interface TrafficReportRepository {
  save(report: TrafficReport): Promise<void>;
  findAll(): Promise<TrafficReport[]>;
  findById(id: string): Promise<TrafficReport | null>;
}
