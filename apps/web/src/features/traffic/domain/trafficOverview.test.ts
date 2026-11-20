/**
 * Hồi quy cho phần tách khỏi App.tsx (20/11/2026): kết quả phải giống hệt logic inline cũ.
 * Logic cũ được chép nguyên văn vào `legacyOverview` làm đáp án chuẩn.
 */
import type { TrafficReportDto } from '@routetwin/shared';
import { describe, expect, it } from 'vitest';
import { toTrafficMapLayer } from './trafficMapLayer';
import { alertCommunityInfo, buildTrafficOverview, type AvoidableIncident } from './trafficOverview';
import { toIncidents, toReportsMapLayer } from './trafficPresentation';

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

/** Chép nguyên văn từ App.tsx trước khi tách (main 034a9ff, dòng 337–414). */
function legacyOverview(
  reports: TrafficReportDto[],
  reportVehicle: 'car' | 'motorcycle',
  demoIncidents: AvoidableIncident[],
) {
  const visibleReports = reports.filter(
    (report) => report.vehicleScope === 'both' || report.vehicleScope === reportVehicle,
  );
  const incidents = toIncidents(visibleReports);
  const layer = toReportsMapLayer(visibleReports);
  const reportsLayer = {
    ...layer,
    features: layer.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, title: t(feature.properties.title) },
    })),
  };
  const trafficLayer =
    demoIncidents.length === 0
      ? reportsLayer
      : {
          ...reportsLayer,
          features: [
            ...reportsLayer.features,
            ...toTrafficMapLayer(
              demoIncidents.map((incident) => ({
                id: incident.id,
                incidentType: 'road_closure',
                severity: 'high' as const,
                vehicleScope: 'both' as const,
                title: incident.title,
                lat: incident.lat,
                lng: incident.lng,
              })),
            ).features.map((feature) => ({
              ...feature,
              properties: { ...feature.properties, title: t(feature.properties.title) },
            })),
          ],
        };
  const routeIncidents = trafficLayer.features
    .filter((feature) => feature.properties.status === 'active' && feature.properties.severity !== 'low')
    .map((feature) => ({
      id: feature.properties.id,
      title: feature.properties.title,
      lng: feature.geometry.coordinates[0]!,
      lat: feature.geometry.coordinates[1]!,
    }));
  return { incidents, trafficLayer, routeIncidents };
}

const reports: TrafficReportDto[] = [
  report({ severity: 'high', vehicleScope: 'car', incidentType: 'accident' }),
  report({ severity: 'low', vehicleScope: 'motorcycle' }),
  report({ severity: 'medium', status: 'cleared', incidentType: 'flood' }),
  report({ severity: 'high', vehicleScope: 'both', incidentType: 'road_closure', lat: 10.8, lng: 106.65 }),
  report({ severity: 'low', vehicleScope: 'both', communityReportCount: 3, communityReporterCount: 2 }),
];
const demo: AvoidableIncident[] = [
  { id: 'demo-1', title: 'Đường đóng (demo)', lat: 10.79, lng: 106.71 },
  { id: 'demo-2', title: 'Đường đóng (demo)', lat: 10.8, lng: 106.72 },
];

describe('buildTrafficOverview giống hệt logic cũ trong App.tsx', () => {
  for (const vehicle of ['car', 'motorcycle'] as const) {
    for (const demoIncidents of [[], demo]) {
      it(`xe ${vehicle}, ${demoIncidents.length} sự cố demo`, () => {
        expect(buildTrafficOverview(reports, vehicle, demoIncidents, t)).toEqual(
          legacyOverview(reports, vehicle, demoIncidents),
        );
      });
    }
  }

  it('lọc đúng: xe máy không thấy sự cố chỉ dành cho ô tô; sự cố mức thấp và đã thông không cần tránh', () => {
    const { incidents, routeIncidents, trafficLayer } = buildTrafficOverview(reports, 'motorcycle', demo, t);
    expect(incidents).toHaveLength(4);
    expect(routeIncidents.map((incident) => incident.id)).toEqual([reports[3]!.id, 'demo-1', 'demo-2']);
    expect(trafficLayer.features.every((feature) => feature.properties.title.startsWith('[en] '))).toBe(true);
  });

  it('danh sách rỗng', () => {
    expect(buildTrafficOverview([], 'car', [], t)).toEqual({
      incidents: [],
      trafficLayer: { type: 'FeatureCollection', features: [] },
      routeIncidents: [],
    });
  });
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
