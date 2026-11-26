import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  alongRoutePoiRequestSchema,
  isInVietmapCoverage,
  nearbyPoiRequestSchema,
  optimizeRouteRequestSchema,
  pathfindingRequestSchema,
  rerouteRequestSchema,
  routeRequestSchema,
  routeStopRequestSchema,
  strictNumber,
  trafficBoundsSchema,
  trafficReportInputSchema,
} from '../src/index.js';

const benThanh = { lat: 10.7725, lng: 106.698 };
const dinhDocLap = { lat: 10.777, lng: 106.6953 };
const paris = { lat: 48.85, lng: 2.35 };

const issueMessages = (result: { success: boolean; error?: z.ZodError }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('strictNumber (thay z.coerce.number trong query string)', () => {
  const lat = strictNumber(z.number().min(-90).max(90));
  it.each([
    ['10.77', 10.77],
    [' 10.77 ', 10.77],
    ['-8', -8],
    ['+8.', 8],
    ['.5', 0.5],
    [10.77, 10.77],
  ])('nhận %j', (input, expected) => expect(lat.parse(input)).toBe(expected));
  it.each(['', '   ', '0x0A', '1e1', 'Infinity', 'NaN', 'abc', '10,5', '1 0'])('từ chối %j', (input) =>
    expect(lat.safeParse(input).success).toBe(false),
  );
  it('từ chối mảng (tham số lặp ?lat=1&lat=2) và giá trị ngoài phạm vi', () => {
    expect(lat.safeParse(['1', '2']).success).toBe(false);
    expect(lat.safeParse('91').success).toBe(false);
  });
  it('giữ mặc định khi thiếu tham số', () =>
    expect(strictNumber(z.number().int()).default(1500).parse(undefined)).toBe(1500));
});

describe('vùng VietMap hỗ trợ', () => {
  it.each([
    benThanh,
    { lat: 21.0285, lng: 105.8542 }, // Hà Nội
    { lat: 10.2899, lng: 103.984 }, // Phú Quốc
    { lat: 8.68, lng: 106.6 }, // Côn Đảo
  ])('trong vùng: %j', (point) => expect(isInVietmapCoverage(point)).toBe(true));
  it.each([paris, { lat: 0, lng: 0 }, { lat: 13.75, lng: 100.5 } /* Bangkok */])('ngoài vùng: %j', (point) =>
    expect(isInVietmapCoverage(point)).toBe(false),
  );
});

describe('routeRequestSchema', () => {
  const base = { vehicle: 'car' as const };
  it('nhận tuyến hợp lệ', () =>
    expect(routeRequestSchema.safeParse({ ...base, points: [dinhDocLap, benThanh] }).success).toBe(true));
  it('từ chối điểm ngoài Việt Nam với thông báo tiếng Việt', () => {
    const result = routeRequestSchema.safeParse({ ...base, points: [paris, benThanh] });
    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain('Vị trí nằm ngoài vùng bản đồ Việt Nam mà iMap hỗ trợ.');
  });
  it('từ chối hai điểm liên tiếp trùng nhau, cho phép quay lại điểm cũ sau điểm khác', () => {
    expect(routeRequestSchema.safeParse({ ...base, points: [benThanh, benThanh] }).success).toBe(false);
    expect(routeRequestSchema.safeParse({ ...base, points: [benThanh, dinhDocLap, benThanh] }).success).toBe(
      true,
    );
  });
  it('avoid: tối đa 2 loại, không trùng', () => {
    const points = [dinhDocLap, benThanh];
    expect(routeRequestSchema.safeParse({ ...base, points, avoid: ['toll', 'ferry'] }).success).toBe(true);
    expect(routeRequestSchema.safeParse({ ...base, points, avoid: ['toll', 'toll'] }).success).toBe(false);
    expect(routeRequestSchema.safeParse({ ...base, points, avoid: ['toll', 'ferry', 'toll'] }).success).toBe(
      false,
    );
  });
});

describe('các yêu cầu khác gọi VietMap cũng chặn tọa độ ngoài vùng', () => {
  it('optimize', () =>
    expect(optimizeRouteRequestSchema.safeParse({ vehicle: 'car', points: [benThanh, paris] }).success).toBe(
      false,
    ));
  it('reroute (from và stops)', () => {
    const ok = { vehicle: 'car', from: dinhDocLap, stops: [benThanh] };
    expect(rerouteRequestSchema.safeParse(ok).success).toBe(true);
    expect(rerouteRequestSchema.safeParse({ ...ok, from: paris }).success).toBe(false);
    expect(rerouteRequestSchema.safeParse({ ...ok, avoidRoads: ['ferry', 'ferry'] }).success).toBe(false);
  });
  it('route-stops: hai đầu khác nhau và từ khóa có chữ', () => {
    const ok = { vehicle: 'car', points: [dinhDocLap, benThanh], query: 'cây xăng' };
    expect(routeStopRequestSchema.safeParse(ok).success).toBe(true);
    expect(routeStopRequestSchema.safeParse({ ...ok, points: [benThanh, benThanh] }).success).toBe(false);
    expect(routeStopRequestSchema.safeParse({ ...ok, query: '!!!???' }).success).toBe(false);
    expect(routeStopRequestSchema.safeParse({ ...ok, query: 'xăng\u0000' }).success).toBe(false);
  });
});

describe('pathfindingRequestSchema', () => {
  const base = { vehicle: 'car', from: dinhDocLap, to: benThanh };
  it('từ chối điểm đầu trùng điểm cuối', () =>
    expect(pathfindingRequestSchema.safeParse({ ...base, to: dinhDocLap }).success).toBe(false));
  it('từ chối thuật toán lặp lại', () =>
    expect(pathfindingRequestSchema.safeParse({ ...base, algorithms: ['astar', 'astar'] }).success).toBe(
      false,
    ));
  it('vẫn mặc định chạy cả hai thuật toán', () =>
    expect(pathfindingRequestSchema.parse(base).algorithms).toEqual(['dijkstra', 'astar']));
});

describe('tìm địa điểm (POI)', () => {
  it('nearby: tọa độ rỗng, hex hay ngoài vùng đều bị từ chối', () => {
    for (const query of [
      { lat: '', lng: '', category: 'cafe' },
      { lat: ' ', lng: ' ', category: 'cafe' },
      { lat: '0x0A', lng: '0x6A', category: 'cafe' },
      { lat: '0', lng: '0', category: 'cafe' },
    ])
      expect(nearbyPoiRequestSchema.safeParse(query).success).toBe(false);
  });
  it('nearby: query string hợp lệ vẫn được đổi sang số, giữ mặc định', () =>
    expect(nearbyPoiRequestSchema.parse({ lat: '10.77', lng: '106.69', category: 'cafe' })).toMatchObject({
      lat: 10.77,
      lng: 106.69,
      radiusM: 1500,
      limit: 15,
    }));
  it('nearby: từ khóa chỉ có ký hiệu bị từ chối', () =>
    expect(nearbyPoiRequestSchema.safeParse({ lat: '10.77', lng: '106.69', query: '%%%' }).success).toBe(
      false,
    ));
  it('along-route: đường đi phải có hai điểm khác nhau và nằm trong vùng', () => {
    expect(
      alongRoutePoiRequestSchema.safeParse({
        category: 'cafe',
        path: [
          [10.77, 106.69],
          [10.78, 106.7],
        ],
      }).success,
    ).toBe(true);
    expect(
      alongRoutePoiRequestSchema.safeParse({
        category: 'cafe',
        path: [
          [10.77, 106.69],
          [10.77, 106.69],
        ],
      }).success,
    ).toBe(false);
    expect(
      alongRoutePoiRequestSchema.safeParse({
        category: 'cafe',
        path: [
          [48.85, 2.35],
          [10.78, 106.7],
        ],
      }).success,
    ).toBe(false);
  });
});

describe('giao thông', () => {
  const bounds = { minLat: '10.7', minLng: '106.6', maxLat: '10.9', maxLng: '106.8' };
  it('nhận khung nhỏ dạng query string', () =>
    expect(trafficBoundsSchema.parse(bounds)).toEqual({
      minLat: 10.7,
      minLng: 106.6,
      maxLat: 10.9,
      maxLng: 106.8,
    }));
  it('từ chối ô trống (trước đây bị hiểu thành 0)', () =>
    expect(trafficBoundsSchema.safeParse({ ...bounds, minLat: '', minLng: '' }).success).toBe(false));
  it('từ chối khung rộng hơn 2° với thông báo rõ ràng', () => {
    const result = trafficBoundsSchema.safeParse({ minLat: -90, minLng: -180, maxLat: 90, maxLng: 180 });
    expect(result.success).toBe(false);
    expect(issueMessages(result).join(' ')).toMatch(/quá rộng/);
  });
  const report = { incidentType: 'accident', severity: 'high', ...benThanh };
  it('báo cáo ngoài Việt Nam bị từ chối', () =>
    expect(trafficReportInputSchema.safeParse({ ...report, ...paris }).success).toBe(false));
  it('ghi chú: trim, chỉ khoảng trắng thì bỏ, giữ xuống dòng, chặn ký tự điều khiển', () => {
    expect(trafficReportInputSchema.parse({ ...report, note: '  Xe tải đổ  ' }).note).toBe('Xe tải đổ');
    expect(trafficReportInputSchema.parse({ ...report, note: '   \n ' }).note).toBeUndefined();
    expect(trafficReportInputSchema.parse({ ...report, note: 'Dòng 1\nDòng 2' }).note).toBe('Dòng 1\nDòng 2');
    expect(trafficReportInputSchema.safeParse({ ...report, note: 'a\u0007b' }).success).toBe(false);
  });
});
