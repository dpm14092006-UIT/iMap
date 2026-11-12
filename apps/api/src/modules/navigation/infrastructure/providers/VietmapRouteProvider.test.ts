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

describe('VietmapRouteProvider avoid', () => {
  it('gửi nhiều tùy chọn tránh, phân tách bằng dấu phẩy', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(vietmapResponse)));
    vi.stubGlobal('fetch', fetcher);
    await new VietmapRouteProvider('test-key').calculate({
      points: [
        { lat: 10.7721, lng: 106.6983 },
        { lat: 10.7949, lng: 106.7218 },
      ],
      vehicle: 'car',
      objective: 'duration',
      avoid: ['toll', 'motorway', 'toll'],
    });
    expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get('avoid')).toBe('toll,motorway');
  });
});

describe('VietmapRouteProvider congestion', () => {
  const twoPoints = [
    { lat: 10.7721, lng: 106.6983 },
    { lat: 10.7949, lng: 106.7218 },
  ];
  const withAnnotations = (annotations: unknown) => ({
    ...vietmapResponse,
    paths: [{ ...vietmapResponse.paths[0]!, annotations }],
  });
  const run = async (body: unknown, points = twoPoints) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetcher);
    const result = await new VietmapRouteProvider('test-key').calculate({
      points,
      vehicle: 'car',
      objective: 'duration',
    });
    return { result, params: new URL(String(fetcher.mock.calls[0]![0])).searchParams };
  };

  it('yêu cầu annotations khi đúng 2 điểm và map sang dạng gọn, chỉ cộng độ dài đoạn ùn/tắc vào heavyMeters, bỏ history_speed', async () => {
    const { result, params } = await run(
      withAnnotations({
        congestion: [
          { value: 'low', first: 0, last: 1 },
          { value: 'severe', first: 1, last: 2 },
          { value: 'weird', first: 2, last: 2 },
          { value: 'heavy', first: 2, last: 99 }, // vượt số tọa độ -> bỏ
        ],
        congestion_distance: [
          { value: 120.5, first: 0, last: 1 },
          { value: 300.4, first: 1, last: 2 },
          { value: 80, first: 2, last: 2 },
          { value: 900, first: 2, last: 99 },
        ],
        history_speed: [{ value: 30, first: 0, last: 1 }],
      }),
    );
    expect(params.get('annotations')).toBe('congestion,congestion_distance');
    expect(result.congestion).toEqual({
      segments: [
        { level: 'low', from: 0, to: 1 },
        { level: 'severe', from: 1, to: 2 },
        { level: 'unknown', from: 2, to: 2 },
      ],
      heavyMeters: 300, // chỉ cộng đoạn severe/heavy hợp lệ; low không tính
    });
    expect(JSON.stringify(result)).not.toContain('history_speed');
  });

  it('không gửi annotations khi có hơn 2 điểm và bỏ qua congestion', async () => {
    const { result, params } = await run(
      withAnnotations({ congestion: [{ value: 'heavy', first: 0, last: 1 }] }),
      [...twoPoints, { lat: 10.8, lng: 106.7 }],
    );
    expect(params.has('annotations')).toBe(false);
    expect(result.congestion).toBeUndefined();
  });

  it('vẫn trả tuyến khi thiếu hoặc sai cấu trúc annotations', async () => {
    for (const body of [
      vietmapResponse,
      withAnnotations(null),
      withAnnotations({ congestion: 'oops' }),
      withAnnotations({ congestion: [{ value: 'low', first: 'a', last: 1 }] }),
    ]) {
      const { result } = await run(body);
      expect(result.distanceMeters).toBe(5294.8);
      expect(result.congestion).toBeUndefined();
    }
  });
});
