import type { AiAnalysisDto } from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';

export const aiVisionApi = {
  history: (accessToken: string) => apiRequest<AiAnalysisDto[]>('/ai/analyses', undefined, accessToken),
  analyzeTraffic: (image: File, accessToken: string) => apiRequest<AiAnalysisDto>('/ai/analyze-traffic', {
    method: 'POST', body: image, headers: { 'Content-Type': image.type },
  }, accessToken),
  recognizeSign: (image: File, accessToken: string) => apiRequest<AiAnalysisDto>('/ai/recognize-sign', {
    method: 'POST', body: image, headers: { 'Content-Type': image.type },
  }, accessToken),
};
