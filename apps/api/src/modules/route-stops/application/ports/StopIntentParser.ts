import type { StopIntent } from '@routetwin/shared';
export interface StopIntentParser {
  parse(
    query: string,
    context?: string[],
  ): Promise<{ intent: StopIntent; source: 'ai' | 'rules'; warning?: string }>;
}
