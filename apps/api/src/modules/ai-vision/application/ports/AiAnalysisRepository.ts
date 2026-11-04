import type { AiAnalysisDto } from '@routetwin/shared';

export interface AiAnalysisRepository {
  save(userId: string, analysis: AiAnalysisDto, imagePath: string): Promise<AiAnalysisDto>;
  list(accessToken: string): Promise<AiAnalysisDto[]>;
}
