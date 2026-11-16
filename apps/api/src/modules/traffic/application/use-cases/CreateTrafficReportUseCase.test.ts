import { describe, expect, it, vi } from 'vitest';
import type { TrafficReportDto } from '@routetwin/shared';
import { CreateTrafficReportUseCase } from './CreateTrafficReportUseCase.js';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
import { trafficPushPayload } from '../../infrastructure/notifications/WebPushTrafficAlertNotifier.js';

const report: TrafficReportDto = {
  id: '11111111-1111-4111-8111-111111111111',
  incidentType: 'traffic_jam',
  severity: 'high',
  vehicleScope: 'both',
  lat: 10.7769,
  lng: 106.7009,
  status: 'active',
  createdAt: '2026-11-16T16:47:00.000Z',
  version: 1,
  communityReportCount: 1,
  communityReporterCount: 1,
};

function repositoryReturning(value: TrafficReportDto): TrafficReportRepository {
  return { create: vi.fn(async () => value), list: vi.fn(), updateClearance: vi.fn() };
}

describe('CreateTrafficReportUseCase', () => {
  it('notifies vehicles on the route after saving the report', async () => {
    const notifier = { notifyNewReport: vi.fn(async () => undefined) };
    const result = await new CreateTrafficReportUseCase(repositoryReturning(report), notifier).execute(
      { incidentType: 'traffic_jam', severity: 'high', vehicleScope: 'both', lat: 10.7769, lng: 106.7009 },
      'token',
    );
    expect(result).toBe(report);
    expect(notifier.notifyNewReport).toHaveBeenCalledWith(report);
  });

  it('still returns the saved report when push delivery fails', async () => {
    const notifier = { notifyNewReport: vi.fn(async () => Promise.reject(new Error('push down'))) };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await new CreateTrafficReportUseCase(repositoryReturning(report), notifier).execute(
      { incidentType: 'traffic_jam', severity: 'high', vehicleScope: 'both', lat: 10.7769, lng: 106.7009 },
      'token',
    );
    expect(result).toBe(report);
    errors.mockRestore();
  });
});

describe('trafficPushPayload', () => {
  it('shows community counts with at least one reporter and Vietnam time', () => {
    const payload = trafficPushPayload(report, {
      community_report_count: 3,
      community_reporter_count: 0,
      community_updated_at: '2026-11-16T16:47:00.000Z',
    });
    expect(payload.title).toContain('Kẹt xe');
    expect(payload.body).toContain('3 báo cáo trong 30 phút / 75 m từ 1 người · cập nhật 23:47');
    expect(payload.report.communityReporterCount).toBe(1);
  });
});
