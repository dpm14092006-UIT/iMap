import { AppError } from '../../../../shared/errors/AppError.js';
import { SupabaseClientFactory } from '../../../../shared/supabase/SupabaseClientFactory.js';
import type { TrafficImageAnalysisQuota } from '../../application/ports/TrafficImageAnalyzer.js';

/** Distributed per-user quota. The database RPC increments atomically across API instances. */
export class SupabaseTrafficImageAnalysisQuota implements TrafficImageAnalysisQuota {
  constructor(private readonly clients = new SupabaseClientFactory()) {}

  async consume(accessToken: string): Promise<void> {
    try {
      const { error } = await this.clients.create(accessToken).rpc('consume_traffic_image_quota');
      if (!error) return;
      if (error.code === 'P0001' && error.message?.includes('TRAFFIC_IMAGE_RATE_LIMIT')) {
        throw new AppError(
          429,
          'TRAFFIC_IMAGE_RATE_LIMIT',
          'Bạn đã dùng hết 10 lượt phân tích ảnh trong giờ này. Vui lòng thử lại sau.',
        );
      }
      if (error.code === '42501') throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập lại');
      console.error('Supabase traffic image quota failed', { code: error.code });
      throw new AppError(
        503,
        'TRAFFIC_IMAGE_QUOTA_UNAVAILABLE',
        'Không thể kiểm tra hạn mức phân tích ảnh lúc này.',
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        503,
        'TRAFFIC_IMAGE_QUOTA_UNAVAILABLE',
        'Không thể kiểm tra hạn mức phân tích ảnh lúc này.',
      );
    }
  }
}
