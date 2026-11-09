import type { TrafficImageAnalysisDto, TrafficImageAnalysisTask } from '@routetwin/shared';

export type TrafficImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface TrafficImageAnalyzer {
  analyze(image: Buffer, mimeType: TrafficImageMimeType, task: TrafficImageAnalysisTask): Promise<TrafficImageAnalysisDto>;
}
