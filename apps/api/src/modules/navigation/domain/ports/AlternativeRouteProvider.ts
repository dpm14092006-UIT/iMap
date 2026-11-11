import type { RouteRequest, RouteResult } from '@routetwin/shared';

/**
 * Port lấy NHIỀU tuyến ứng viên cho cùng một yêu cầu (tuyến chính + tuyến thay thế).
 * Tách riêng khỏi RouteProvider (nguyên tắc ISP) vì chỉ tính năng tính lại tuyến cần dùng.
 */
export interface AlternativeRouteProvider {
  /** Danh sách tuyến, tốt nhất đứng đầu. Không bao giờ rỗng (lỗi thì ném AppError). */
  calculateAlternatives(input: RouteRequest): Promise<RouteResult[]>;
}
