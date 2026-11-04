import type { AiQuotaRepository } from '../ports/AiQuotaRepository.js';

export class ConsumeAiQuotaUseCase {
  constructor(private readonly repository: AiQuotaRepository) {}
  execute(accessToken: string): Promise<void> {
    return this.repository.consume(accessToken);
  }
}
