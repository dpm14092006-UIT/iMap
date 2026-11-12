import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClientFactory } from '../../../../shared/supabase/SupabaseClientFactory.js';
import { SupabaseTrafficReportRepository } from './SupabaseTrafficReportRepository.js';

describe('SupabaseTrafficReportRepository vehicle scope rollout', () => {
  it('falls back to the current RPC signature while the database migration is pending', async () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      incident_type: 'traffic_jam',
      severity: 'high',
      lat: 10,
      lng: 106,
      note: null,
      gps_accuracy_m: null,
      heading_deg: null,
      image_path: null,
      status: 'active',
      created_at: '2026-11-12T07:00:00.000Z',
      expires_at: '2026-11-12T11:00:00.000Z',
      version: 1,
    };
    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
      .mockResolvedValueOnce({
        data: row,
        error: null,
      });
    const rpc = vi.fn(() => ({ single }));
    const clients = { create: vi.fn(() => ({ rpc })) } as unknown as SupabaseClientFactory;
    const repository = new SupabaseTrafficReportRepository(clients);

    const report = await repository.create(
      { incidentType: 'traffic_jam', severity: 'high', vehicleScope: 'car', lat: 10, lng: 106 },
      'access-token',
    );

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      'create_traffic_report',
      expect.objectContaining({ p_vehicle_scope: 'car' }),
    );
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'create_traffic_report',
      expect.not.objectContaining({ p_vehicle_scope: expect.anything() }),
    );
    expect(report.vehicleScope).toBe('both');
  });
});
