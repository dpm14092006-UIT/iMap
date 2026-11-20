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
  it.each([
    { lat: Number.NaN },
    { lat: Number.POSITIVE_INFINITY },
    { lng: Number.NaN },
    { version: Number.NaN },
    { version: Number.POSITIVE_INFINITY },
    { version: -1 },
    { version: 0 },
    { version: 1.5 },
  ])('rejects non-finite coordinates and invalid versions: %j', (override) => {
    expect(parseRealtimeReport({ ...valid, ...override })).toBeNull();
  });

  it('rejects JSON objects in enum fields without coercing or throwing', () => {
    const malformed = { ...valid, incidentType: { toString: {} } };
    expect(() => parseRealtimeReport(malformed)).not.toThrow();
    expect(parseRealtimeReport(malformed)).toBeNull();
  });

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
