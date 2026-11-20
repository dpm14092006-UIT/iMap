/**
 * Hồi quy cho phần tách khỏi App.tsx (20/11/2026): kết quả phải giống hệt logic inline cũ.
 * Logic cũ được chép nguyên văn vào `legacyOverview` làm đáp án chuẩn.
 */
import type { TrafficReportDto } from '@routetwin/shared';
import { describe, expect, it } from 'vitest';
import { alertCommunityInfo, buildTrafficOverview } from './trafficOverview';

const t = (text: string) => `[en] ${text}`;

function report(overrides: Partial<TrafficReportDto>): TrafficReportDto {
  return {
    id: crypto.randomUUID(),
    incidentType: 'traffic_jam',
    severity: 'medium',
    vehicleScope: 'both',
    lat: 10.77,
    lng: 106.7,
    status: 'active',
    createdAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

describe('community traffic overview', () => {
  const reports: TrafficReportDto[] = [
    report({ id: 'car', vehicleScope: 'car', severity: 'high' }),
    report({ id: 'bike', vehicleScope: 'motorcycle' }),
    report({ id: 'all', vehicleScope: 'both' }),
    report({ id: 'low', severity: 'low' }),
    report({ id: 'cleared', status: 'cleared' }),
  ];
  it.each(['car', 'motorcycle'] as const)('contains only server reports for %s', (vehicle) => {
    const result = buildTrafficOverview(reports, vehicle, t);
    const ids = result.trafficLayer.features.map((feature) => feature.properties.id);
    expect(ids).toEqual([vehicle === 'car' ? 'car' : 'bike', 'all', 'low', 'cleared']);
    expect(result.routeIncidents.map((report) => report.id)).toEqual([
      vehicle === 'car' ? 'car' : 'bike',
      'all',
    ]);
    expect(
      result.trafficLayer.features.every((feature) => feature.properties.title.startsWith('[en] ')),
    ).toBe(true);
  });
  it('handles an empty server response without inventing incidents', () =>
    expect(buildTrafficOverview([], 'car', t)).toEqual({
      incidents: [],
      trafficLayer: { type: 'FeatureCollection', features: [] },
      routeIncidents: [],
    }));
});

describe('alertCommunityInfo giống logic cũ của hộp cảnh báo', () => {
  /** Chép nguyên văn từ App.tsx trước khi tách (dòng 1499–1513). */
  const legacy = (
    alertedReport: Partial<TrafficReportDto> | null | undefined,
    incident: { communityReportCount?: number; communityReporterCount?: number; communityUpdatedAt?: string },
  ) => ({
    reportCount: Math.max(1, alertedReport?.communityReportCount ?? incident.communityReportCount ?? 1),
    reporterCount: Math.max(1, alertedReport?.communityReporterCount ?? incident.communityReporterCount ?? 1),
    updatedAt:
      alertedReport?.communityUpdatedAt ?? alertedReport?.createdAt ?? incident.communityUpdatedAt ?? null,
  });

  const reportCases: (Partial<TrafficReportDto> | null | undefined)[] = [
    undefined,
    null,
    report({}),
    report({ communityReportCount: 0, communityReporterCount: 0 }),
    report({
      communityReportCount: 5,
      communityReporterCount: 3,
      communityUpdatedAt: '2026-11-20T09:00:00.000Z',
    }),
    report({ communityUpdatedAt: null }),
  ];
  const pushedCases = [
    {},
    { communityReportCount: 4 },
    { communityReportCount: 2, communityReporterCount: 2, communityUpdatedAt: '2026-11-20T07:00:00.000Z' },
  ];
  for (const [i, alerted] of reportCases.entries()) {
    for (const [j, pushed] of pushedCases.entries()) {
      it(`báo cáo #${i} × push #${j}`, () => {
        expect(alertCommunityInfo(alerted as TrafficReportDto | null | undefined, pushed)).toEqual(
          legacy(alerted, pushed),
        );
      });
    }
  }
});
