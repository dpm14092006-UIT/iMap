import type { CongestionLevel, RouteCongestion, RouteRequest, RouteResult } from '@routetwin/shared';
import { z } from 'zod';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { AlternativeRouteProvider } from '../../domain/ports/AlternativeRouteProvider.js';
import type { RouteProvider } from '../../domain/ports/RouteProvider.js';

const vietmapResponseSchema = z.object({
  code: z.string(),
  messages: z.union([z.string(), z.array(z.string())]).optional(),
  paths: z
    .array(
      z.object({
        distance: z.number().finite().nonnegative(),
        time: z.number().finite().nonnegative(),
        // null khi không yêu cầu annotation `toll`.
        toll_cost: z.number().finite().nonnegative().nullish(),
        // Với points_encoded=false, VietMap Route v4 trả GeoJSON LineString: coordinates là [lng, lat].
        points: z.object({
          type: z.literal('LineString'),
          coordinates: z.array(z.tuple([z.number().finite(), z.number().finite()])),
        }),
        // Lỗi/thiếu annotations không được làm hỏng tuyến: đọc lỏng ở đây, kiểm tra kỹ ở parseCongestion.
        annotations: z.unknown().optional(),
        instructions: z
          .array(
            z.object({
              distance: z.number().finite().nonnegative().default(0),
              time: z.number().finite().nonnegative().default(0),
              text: z.string().optional().default(''),
              street_name: z.string().optional().default(''),
              sign: z.number().optional(),
              heading: z.number().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

const congestionAnnotationsSchema = z.object({
  congestion: z.array(
    z.object({
      value: z.string(),
      first: z.number().int().nonnegative(),
      last: z.number().int().nonnegative(),
    }),
  ),
  congestion_distance: z
    .array(
      z.object({
        value: z.number().finite().nonnegative(),
        first: z.number().int().nonnegative().optional(),
        last: z.number().int().nonnegative().optional(),
      }),
    )
    .optional()
    .default([]),
});

const KNOWN_LEVELS = new Set<string>(['low', 'moderate', 'heavy', 'severe']);

/** Đổi annotations của VietMap sang dạng gọn; trả undefined khi thiếu hoặc sai cấu trúc. */
function parseCongestion(annotations: unknown, coordinateCount: number): RouteCongestion | undefined {
  const parsed = congestionAnnotationsSchema.safeParse(annotations);
  if (!parsed.success) return undefined;
  const { congestion, congestion_distance: distances } = parsed.data;
  const segments: RouteCongestion['segments'] = [];
  let heavyMeters = 0;
  congestion.forEach(({ value, first, last }, index) => {
    if (first > last || last >= coordinateCount) return;
    const level = (KNOWN_LEVELS.has(value) ? value : 'unknown') as CongestionLevel;
    segments.push({ level, from: first, to: last });
    // congestion_distance liệt kê độ dài (mét) của MỌI đoạn (tổng ≈ chiều dài tuyến), nên chỉ cộng
    // các đoạn ùn/tắc; ghép theo first/last, hoặc theo vị trí khi VietMap không kèm chỉ số.
    if (level !== 'heavy' && level !== 'severe') return;
    const meters =
      distances.find((item) => item.first === first && item.last === last) ??
      (distances.every((item) => item.first === undefined) ? distances[index] : undefined);
    heavyMeters += meters?.value ?? 0;
  });
  if (!segments.length) return undefined;
  heavyMeters = Math.round(heavyMeters);
  return { segments, heavyMeters };
}

export class VietmapRouteProvider implements RouteProvider, AlternativeRouteProvider {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly timeoutMs = 12_000,
  ) {}

  /** Mọi tuyến VietMap trả về cho một lời gọi (tuyến chính + tuyến thay thế), tốt nhất đứng đầu. Dùng cho tính lại tuyến. */
  async calculateAlternatives(input: RouteRequest): Promise<RouteResult[]> {
    const { alternatives, ...primary } = await this.calculate({ ...input, alternatives: true });
    return [primary, ...(alternatives ?? [])];
  }

  async calculate(input: RouteRequest): Promise<RouteResult> {
    const apiKey = this.apiKey?.trim();
    if (!apiKey) {
      throw new AppError(
        503,
        'VIETMAP_NOT_CONFIGURED',
        'Chưa cấu hình VIETMAP_API_KEY cho dịch vụ chỉ đường.',
      );
    }

    const url = new URL('https://maps.vietmap.vn/api/route/v4');
    url.searchParams.set('apikey', apiKey);
    input.points.forEach(({ lat, lng }) => url.searchParams.append('point', `${lat},${lng}`));
    url.searchParams.set('points_encoded', 'false');
    url.searchParams.set('vehicle', input.vehicle);
    url.searchParams.set('alternative', String(input.alternatives ?? false));
    // Tài liệu VietMap: annotations tính theo từng chặng nên chỉ tin cậy khi đúng 2 điểm.
    if (input.points.length === 2) {
      url.searchParams.set('annotations', 'congestion,congestion_distance,toll');
    }
    if (input.avoid?.length) url.searchParams.set('avoid', [...new Set(input.avoid)].join(','));

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new AppError(
          504,
          'ROUTE_PROVIDER_TIMEOUT',
          'Dịch vụ chỉ đường phản hồi quá chậm. Hãy thử lại.',
        );
      }
      throw new AppError(502, 'ROUTE_PROVIDER_UNAVAILABLE', 'Không kết nối được dịch vụ chỉ đường VietMap.');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          502,
          'ROUTE_PROVIDER_AUTH',
          'VietMap từ chối API key. Kiểm tra key và phạm vi sử dụng trong cấu hình máy chủ.',
        );
      }
      if (response.status === 429) {
        throw new AppError(
          429,
          'ROUTE_PROVIDER_RATE_LIMIT',
          'VietMap đang giới hạn yêu cầu. Vui lòng thử lại sau ít phút.',
        );
      }
      if (response.status === 423) {
        throw new AppError(
          503,
          'ROUTE_PROVIDER_QUOTA',
          'Tài khoản VietMap chưa bật API hoặc đã hết hạn mức.',
        );
      }
      throw new AppError(502, 'ROUTE_PROVIDER_ERROR', 'VietMap chưa thể tính tuyến lúc này.');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AppError(
        502,
        'ROUTE_PROVIDER_INVALID_RESPONSE',
        'VietMap trả về dữ liệu tuyến không hợp lệ.',
      );
    }

    const parsed = vietmapResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(
        502,
        'ROUTE_PROVIDER_INVALID_RESPONSE',
        'Không đọc được hình học tuyến VietMap trả về.',
      );
    }
    if (parsed.data.code !== 'OK' || parsed.data.paths.length === 0) {
      const detail =
        typeof parsed.data.messages === 'string' ? parsed.data.messages : parsed.data.messages?.join(' ');
      if (parsed.data.code === 'OVER_DAILY_LIMIT') {
        throw new AppError(429, 'ROUTE_PROVIDER_QUOTA', 'VietMap đã đạt giới hạn yêu cầu trong ngày.');
      }
      if (parsed.data.code === 'ZERO_RESULTS') {
        throw new AppError(
          422,
          'ROUTE_NOT_FOUND',
          'VietMap không tìm được tuyến phù hợp giữa các điểm đã chọn.',
        );
      }
      throw new AppError(502, 'ROUTE_PROVIDER_ERROR', detail || 'VietMap không tính được tuyến.');
    }

    const paths = [...parsed.data.paths].sort((a, b) =>
      input.objective === 'distance' ? a.distance - b.distance : a.time - b.time,
    );
    const usablePaths = paths.filter((path) => path.points.coordinates.length >= 2);
    if (!usablePaths.length) {
      throw new AppError(
        502,
        'ROUTE_PROVIDER_INVALID_RESPONSE',
        'VietMap trả về tuyến thiếu tọa độ đường đi.',
      );
    }

    const toRoutePath = (path: (typeof usablePaths)[number]) => {
      const congestion =
        input.points.length === 2
          ? parseCongestion(path.annotations, path.points.coordinates.length)
          : undefined;
      return {
        source: 'vietmap' as const,
        distanceMeters: path.distance,
        durationSeconds: Math.round(path.time / 1000),
        // Đã đúng thứ tự GeoJSON [lng, lat] của dự án nên giữ nguyên.
        coordinates: path.points.coordinates,
        instructions: path.instructions
          .filter((instruction) => instruction.text.trim() || instruction.street_name.trim())
          .map((instruction) => ({
            distanceMeters: instruction.distance,
            durationSeconds: Math.round(instruction.time / 1000),
            text: instruction.text,
            streetName: instruction.street_name,
            ...(instruction.sign === undefined ? {} : { sign: instruction.sign }),
            ...(instruction.heading === undefined ? {} : { heading: instruction.heading }),
          })),
        ...(path.toll_cost == null ? {} : { tollCostVnd: path.toll_cost }),
        ...(congestion ? { congestion } : {}),
      };
    };
    const [primary, ...alternatives] = usablePaths.map(toRoutePath);
    return {
      ...primary!,
      ...(input.alternatives && alternatives.length ? { alternatives } : {}),
    };
  }
}
