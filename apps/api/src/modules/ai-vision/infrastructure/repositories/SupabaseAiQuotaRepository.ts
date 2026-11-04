import type { AiQuotaRepository } from '../../application/ports/AiQuotaRepository.js';
import { SupabaseClientFactory } from '../../../../shared/supabase/SupabaseClientFactory.js';
import { AppError } from '../../../../shared/errors/AppError.js';

export class SupabaseAiQuotaRepository implements AiQuotaRepository {
  constructor(private readonly clients = new SupabaseClientFactory()) {}

  async consume(accessToken: string): Promise<void> {
    const { error } = await this.clients.create(accessToken).rpc('consume_ai_analysis_quota');
    if (!error) return;
    if (error.code === 'P0001' && error.message.includes('AI_RATE_LIMIT')) {
      throw new AppError(429, 'AI_RATE_LIMIT', 'Đã đạt giới hạn 10 lượt phân tích trong một giờ');
    }
    console.error('Supabase AI quota check failed', { code: error.code });
    throw new AppError(503, 'AI_QUOTA_UNAVAILABLE', 'Không thể xác nhận hạn mức AI lúc này');
  }
}
