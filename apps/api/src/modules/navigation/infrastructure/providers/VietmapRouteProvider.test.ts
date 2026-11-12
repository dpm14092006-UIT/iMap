import { afterEach, describe, expect, it, vi } from 'vitest';
import { VietmapRouteProvider } from './VietmapRouteProvider.js';

/** Phản hồi rút gọn theo đúng cấu trúc thật của VietMap Route v4 (points_encoded=false). */
const vietmapResponse = {
  code: 'OK',
  paths: [
    {
      distance: 5294.8,
      time: 644490, // mili giây
      points: {
        type: 'LineString',
        coordinates: [
          [106.698353, 10.772017],
          [106.698044, 10.771826],
          [106.7216, 10.7951],
        ],
      },
      instructions: [
        {
          distance: 62.7,
          time: 7781,
          sign: 0,
          heading: 238,
          text: 'tiếp tục đến Lê Lợi',
          street_name: 'Lê Lợi',
        },
        { distance: 0, time: 0, sign: 4, text: 'Đến nơi', street_name: '' },
      ],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('VietmapRouteProvider', () => {
  it('đọc GeoJSON LineString và đổi đơn vị thời gian sang giây', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(vietmapResponse))));
    const result = await new VietmapRouteProvider('test-key').calculate({
      points: [
        { lat: 10.7721, lng: 106.6983 },
        { lat: 10.7949, lng: 106.7218 },
      ],
      vehicle: 'motorcycle',
      objective: 'duration',
    });
    expect(result.distanceMeters).toBe(5294.8);
    expect(result.durationSeconds).toBe(644);
    expect(result.coordinates[0]).toEqual([106.698353, 10.772017]); // giữ [lng, lat]
    expect(result.instructions).toHaveLength(2);
    expect(result.instructions[0]).toMatchObject({ streetName: 'Lê Lợi', durationSeconds: 8 });
  });

  it('trả thêm các tuyến thay thế, sắp theo thời gian và gửi tùy chọn tránh phà', async () => {
    const response = {
      ...vietmapResponse,
      paths: [
        {
          ...vietmapResponse.paths[0]!,
          distance: 6200,
          time: 720000,
          toll_cost: 15000,
        },
        {
          ...vietmapResponse.paths[0]!,
          distance: 5400,
          time: 600000,
        },
      ],
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
    vi.stubGlobal('fetch', fetcher);

    const result = await new VietmapRouteProvider('test-key').calculate({
      points: [
        { lat: 10.7721, lng: 106.6983 },
        { lat: 10.7949, lng: 106.7218 },
      ],
      vehicle: 'car',
      objective: 'duration',
      alternatives: true,
      avoid: ['ferry'],
    });

    const requestUrl = new URL(String(fetcher.mock.calls[0]![0]));
    expect(requestUrl.searchParams.get('vehicle')).toBe('car');
    expect(requestUrl.searchParams.get('alternative')).toBe('true');
    expect(requestUrl.searchParams.get('avoid')).toBe('ferry');
    expect(result.durationSeconds).toBe(600);
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives?.[0]).toMatchObject({ distanceMeters: 6200, tollCostVnd: 15000 });
  });

  it('báo lỗi 503 khi chưa cấu hình key', async () => {
    await expect(
      new VietmapRouteProvider(undefined).calculate({
        points: [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
        ],
        vehicle: 'car',
        objective: 'duration',
      }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'VIETMAP_NOT_CONFIGURED' });
  });
});
