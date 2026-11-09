import type { TrafficImageAnalysisDto, TrafficImageAnalysisTask } from '@routetwin/shared';
import type { TrafficImageAnalyzer, TrafficImageMimeType } from '../ports/TrafficImageAnalyzer.js';

export class AnalyzeTrafficImageUseCase {
  constructor(private readonly analyzer: TrafficImageAnalyzer) {}

  execute(image: Buffer, mimeType: TrafficImageMimeType, task: TrafficImageAnalysisTask): Promise<TrafficImageAnalysisDto> {
    return this.analyzer.analyze(image, mimeType, task);
  }
}
