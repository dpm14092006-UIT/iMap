import { randomUUID } from 'node:crypto';
import type { AiAnalysisDto } from '@routetwin/shared';
import type { AiAnalysisRepository } from '../ports/AiAnalysisRepository.js';
import type { AiImageStorage } from '../ports/AiImageStorage.js';
import type { AiVisionProvider, VisionImage } from '../ports/AiVisionProvider.js';

export class RecognizeTrafficSignUseCase {
  constructor(private readonly provider: AiVisionProvider, private readonly repository: AiAnalysisRepository, private readonly images: AiImageStorage) {}

  async execute(image: VisionImage, userId: string, accessToken: string): Promise<AiAnalysisDto> {
    const output = await this.provider.recognizeSign(image);
    const imagePath = await this.images.save(image, userId, accessToken);
    try {
      return await this.repository.save(userId, {
        id: randomUUID(), task: 'sign_recognition', result: output.result,
        model: output.model, processedAt: new Date().toISOString(), imagePath,
      }, imagePath);
    } catch (error) {
      await this.images.remove(imagePath, accessToken).catch(() => undefined);
      throw error;
    }
  }
}
