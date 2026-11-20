/**
 * Hồi quy cho các hàm được chuyển khỏi App.tsx sang feature sở hữu (20/11/2026).
 * Mỗi đáp án chuẩn chép nguyên văn từ App.tsx cũ (main 034a9ff).
 */
import type { StopPlace } from '@routetwin/shared';
import { describe, expect, it } from 'vitest';
import { poiMetaFor } from '../../features/explore/domain/poiCatalog';
import { placeFromPoi } from '../../features/explore/domain/poiPlace';
import type { Poi } from '../../features/explore/types';
import { placeFromStop } from '../../features/place-assistant/domain/stopPlace';
import { popularPlaces } from '../../features/places/domain/popularPlaces';
import { findPopularPlaceNear } from '../../features/places/domain/nearbyPopularPlace';
import type { Place } from '../../features/places/types';
import { pickCommunityCounts } from '../../features/traffic/domain/realtimeReport';
import { errorMessage } from '../../shared/text/errorMessage';

const legacyFindPlaceNear = (point: { lat: number; lng: number }): Place | null =>
  popularPlaces.find(
    (place) => Math.abs(place.lat - point.lat) < 0.002 && Math.abs(place.lng - point.lng) < 0.002,
  ) ?? null;

const legacyPickCommunityCounts = (report: object) => {
  const value = report as {
    communityReportCount?: unknown;
    communityReporterCount?: unknown;
    communityUpdatedAt?: unknown;
  };
  return {
    ...(typeof value.communityReportCount === 'number'
      ? { communityReportCount: value.communityReportCount }
      : {}),
    ...(typeof value.communityReporterCount === 'number'
      ? { communityReporterCount: value.communityReporterCount }
      : {}),
    ...(typeof value.communityUpdatedAt === 'string' ? { communityUpdatedAt: value.communityUpdatedAt } : {}),
  };
};

describe('hàm chuyển khỏi App.tsx', () => {
  it('findPopularPlaceNear khớp findPlaceNear cũ trên lưới điểm quanh mọi địa điểm gợi ý', () => {
    expect(popularPlaces.length).toBeGreaterThan(0);
    const offsets = [-0.0025, -0.002, -0.0019, -0.001, 0, 0.001, 0.0019, 0.002, 0.0025];
    for (const place of popularPlaces) {
      for (const dLat of offsets) {
        for (const dLng of offsets) {
          const point = { lat: place.lat + dLat, lng: place.lng + dLng };
          expect(findPopularPlaceNear(point)).toBe(legacyFindPlaceNear(point));
        }
      }
    }
    expect(findPopularPlaceNear({ lat: 0, lng: 0 })).toBeNull();
  });

  it('pickCommunityCounts khớp bản cũ, kể cả trường sai kiểu', () => {
    const cases: object[] = [
      {},
      { communityReportCount: 3 },
      { communityReportCount: '3', communityReporterCount: 2, communityUpdatedAt: '2026-11-20T08:00:00Z' },
      { communityReportCount: 0, communityReporterCount: null, communityUpdatedAt: 123 },
      { communityReportCount: Number.NaN, other: 'x' },
    ];
    for (const value of cases) expect(pickCommunityCounts(value)).toEqual(legacyPickCommunityCounts(value));
  });

  it('placeFromPoi giữ nguyên trường và nhãn danh mục', () => {
    const poi = {
      id: 'p1',
      name: 'Quán A',
      address: '1 Lê Lợi',
      category: 'cafe',
      lat: 10.7,
      lng: 106.6,
    } as Poi;
    expect(placeFromPoi(poi)).toEqual({
      id: 'p1',
      name: 'Quán A',
      address: '1 Lê Lợi',
      category: poiMetaFor(poi.category).label,
      lat: 10.7,
      lng: 106.6,
      source: 'poi',
    });
  });

  it('placeFromStop giữ nguyên trường, nguồn osm', () => {
    const stop = {
      id: 's1',
      name: 'Trạm xăng',
      address: 'QL1A',
      category: 'fuel',
      lat: 10.8,
      lng: 106.7,
    } as StopPlace;
    expect(placeFromStop(stop)).toEqual({ ...stop, source: 'osm' });
  });

  it('errorMessage', () => {
    expect(errorMessage(new Error('lỗi thật'), 'mặc định')).toBe('lỗi thật');
    expect(errorMessage('chuỗi', 'mặc định')).toBe('mặc định');
    expect(errorMessage(undefined, 'mặc định')).toBe('mặc định');
  });
});
