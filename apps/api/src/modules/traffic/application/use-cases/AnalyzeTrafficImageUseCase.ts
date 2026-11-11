import type { TrafficImageAnalysisDto, TrafficImageAnalysisTask } from '@routetwin/shared';
import { AppError } from '../../../../shared/errors/AppError.js';
import type {
  TrafficImageAnalysisQuota,
  TrafficImageAnalyzer,
  TrafficImageMimeType,
} from '../ports/TrafficImageAnalyzer.js';

export class AnalyzeTrafficImageUseCase {
  constructor(
    private readonly analyzer: TrafficImageAnalyzer,
    private readonly quota?: TrafficImageAnalysisQuota,
    private readonly enabled = true,
  ) {}

  async execute(
    image: Buffer,
    mimeType: TrafficImageMimeType,
    task: TrafficImageAnalysisTask,
    accessToken?: string,
  ): Promise<TrafficImageAnalysisDto> {
    if (this.enabled && this.quota) {
      if (!accessToken) throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để phân tích ảnh');
      await this.quota.consume(accessToken);
    }
    return this.analyzer.analyze(image, mimeType, task);
  }
}
