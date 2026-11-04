import type { AiAnalysisDto } from '@routetwin/shared';
import type { AiAnalysisRepository } from '../ports/AiAnalysisRepository.js';

export class ListAiAnalysesUseCase {
  constructor(private readonly repository: AiAnalysisRepository) {}
  execute(accessToken: string): Promise<AiAnalysisDto[]> {
    return this.repository.list(accessToken);
  }
}
