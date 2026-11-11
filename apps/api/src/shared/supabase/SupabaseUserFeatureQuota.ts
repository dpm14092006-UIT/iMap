import { AppError } from '../errors/AppError.js';
import { SupabaseClientFactory } from './SupabaseClientFactory.js';

export type QuotaFeature = 'route_stops' | 'voice';

/** Shared per-user minute quota for authenticated endpoints that call external providers. */
export class SupabaseUserFeatureQuota {
  constructor(private readonly clients = new SupabaseClientFactory()) {}

  async consume(feature: QuotaFeature, accessToken: string): Promise<void> {
    try {
      const { error } = await this.clients
        .create(accessToken)
        .rpc('consume_user_feature_quota', { p_feature: feature });
      if (!error) return;
      if (error.code === 'P0001' && error.message?.includes('FEATURE_RATE_LIMIT')) {
        throw new AppError(
          429,
          'FEATURE_RATE_LIMIT',
          'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau một phút.',
        );
      }
      if (error.code === '42501') throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập lại');
      console.error('Supabase user feature quota failed', { feature, code: error.code });
      throw new AppError(503, 'FEATURE_QUOTA_UNAVAILABLE', 'Không thể kiểm tra hạn mức sử dụng lúc này.');
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'FEATURE_QUOTA_UNAVAILABLE', 'Không thể kiểm tra hạn mức sử dụng lúc này.');
    }
  }
}
