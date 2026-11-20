import { describe, expect, it } from 'vitest';
import { parseRealtimeReport } from './realtimeReport';

const valid = {
  id: 'r1',
  incidentType: 'accident',
  severity: 'high',
  vehicleScope: 'car',
  lat: 10.77,
  lng: 106.7,
  status: 'active',
  version: 2,
};

describe('parseRealtimeReport (review #14)', () => {
  it('nhận payload Web Push hợp lệ', () => {
    expect(parseRealtimeReport({ ...valid, communityReportCount: 3 })).toEqual(valid);
  });

  it('từ chối payload sai kiểu hoặc thiếu trường thay vì đưa thẳng vào app', () => {
    expect(parseRealtimeReport(null)).toBeNull();
    expect(parseRealtimeReport('rác')).toBeNull();
    expect(parseRealtimeReport({ ...valid, lat: '10.77' })).toBeNull();
    expect(parseRealtimeReport({ ...valid, lat: 200 })).toBeNull();
    expect(parseRealtimeReport({ ...valid, incidentType: 'alien' })).toBeNull();
    expect(parseRealtimeReport({ ...valid, id: undefined })).toBeNull();
  });

  it('thiếu vehicleScope/version thì dùng mặc định', () => {
    const { vehicleScope: _scope, version: _version, ...rest } = valid;
    expect(parseRealtimeReport(rest)).toMatchObject({ vehicleScope: 'both', version: 1 });
  });
});
