import type { RouteComparisonFact, RouteComparisonSnapshot, RouteResult } from '@routetwin/shared';

/**
 * Ảnh chụp có chữ ký của các phương án tuyến vừa tính: client gửi lại khi so sánh nên server
 * không phải tin số liệu do client tự khai và cũng không phải gọi lại VietMap.
 */
export interface RouteComparisonSnapshots {
  sign(result: RouteResult, sessionId: string, aiAvailable: boolean): RouteComparisonSnapshot | undefined;
  /** Ném AppError 410 nếu chữ ký sai, sai phiên hoặc đã hết hạn. */
  verify(token: string, sessionId: string): [RouteComparisonFact, ...RouteComparisonFact[]];
}
