import { z } from 'zod';
import { geoPointSchema, type RouteResult } from './routes.js';

/**
 * Hợp đồng cho POST /api/routes/reroute: tính lại tuyến từ VỊ TRÍ HIỆN TẠI khi đi lệch tuyến
 * hoặc khi phía trước có sự cố chặn đường. Tuyến mới cố gắng tránh các sự cố trong `avoid`.
 */

/** Một sự cố cần tránh: tuyến mới không được đi qua vòng tròn bán kính radiusMeters quanh điểm này. */
export const blockingIncidentSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10).max(1000).default(60),
});
export type BlockingIncident = z.infer<typeof blockingIncidentSchema>;

export const rerouteRequestSchema = z.object({
  /** Vị trí hiện tại của xe. */
  from: geoPointSchema,
  /** Các điểm còn phải đi qua theo thứ tự; điểm cuối là đích. */
  stops: z.array(geoPointSchema).min(1).max(15),
  vehicle: z.enum(['car', 'motorcycle']),
  objective: z.enum(['distance', 'duration']).default('duration'),
  avoid: z.array(blockingIncidentSchema).max(30).default([]),
});
export type RerouteRequest = z.infer<typeof rerouteRequestSchema>;

/**
 * Cách tuyến mới được chọn:
 * - direct:      tuyến tốt nhất không đi qua sự cố nào
 * - alternative: tuyến tốt nhất bị chặn, dùng tuyến thay thế của VietMap
 * - detour:      cả hai bị chặn, đi vòng qua một điểm cạnh sự cố
 * - unavoidable: không tìm được tuyến tránh, trả tuyến tốt nhất kèm cảnh báo
 */
export type RerouteStrategy = 'direct' | 'alternative' | 'detour' | 'unavoidable';

export type RerouteResult = {
  route: RouteResult;
  strategy: RerouteStrategy;
  /** Số sự cố tuyến mới vẫn đi qua (0 nếu tránh được hết). */
  blockedCount: number;
  /** Số tuyến ứng viên đã xem xét. */
  candidatesChecked: number;
};
