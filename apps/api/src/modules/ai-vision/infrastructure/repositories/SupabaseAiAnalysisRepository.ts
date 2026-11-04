import type { AiAnalysisDto } from '@routetwin/shared';
import type { AiAnalysisRepository } from '../../application/ports/AiAnalysisRepository.js';
import { SupabaseClientFactory } from '../../../../shared/supabase/SupabaseClientFactory.js';
import { AppError } from '../../../../shared/errors/AppError.js';

export class SupabaseAiAnalysisRepository implements AiAnalysisRepository {
  constructor(private readonly clients = new SupabaseClientFactory()) {}

  async save(userId: string, analysis: AiAnalysisDto, imagePath: string): Promise<AiAnalysisDto> {
    const { data, error } = await this.clients.createAdmin().from('ai_analyses').insert({
      user_id: userId,
      task: analysis.task,
      result: analysis.result,
      model: analysis.model,
      image_path: imagePath,
    }).select('id, task, result, model, image_path, created_at').single();
    if (error) {
      console.error('Supabase AI analysis persistence failed', { code: error.code });
      throw new AppError(503, 'AI_RESULT_NOT_SAVED', 'Không thể lưu kết quả phân tích lúc này');
    }
    return {
      id: data.id,
      task: data.task,
      result: data.result as Record<string, unknown>,
      model: data.model,
      imagePath: data.image_path,
      processedAt: data.created_at,
    };
  }

  async list(accessToken: string): Promise<AiAnalysisDto[]> {
    const { data, error } = await this.clients.create(accessToken).from('ai_analyses')
      .select('id, task, result, model, image_path, created_at')
      .order('created_at', { ascending: false }).limit(20);
    if (error) {
      console.error('Supabase AI history query failed', { code: error.code });
      throw new AppError(503, 'AI_HISTORY_UNAVAILABLE', 'Không thể tải lịch sử phân tích lúc này');
    }
    return data.map((row) => ({
      id: row.id,
      task: row.task,
      result: row.result as Record<string, unknown>,
      model: row.model,
      imagePath: row.image_path,
      processedAt: row.created_at,
    }));
  }
}
