import type { ExplorePlacesRequest, ExplorePlacesResponse } from '@routetwin/shared';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';

/** Client cho các endpoint dành cho thành viên: tìm điểm dừng bằng AI và nhận dạng giọng nói. */
export class AssistantApiClient {
  constructor(private readonly http: HttpClient) {}

  explorePlaces(request: ExplorePlacesRequest, signal: AbortSignal, accessToken: string) {
    return this.http.post<ExplorePlacesResponse>('/route-stops/explore', request, { signal, accessToken });
  }

  routeStopsConfig(signal: AbortSignal, accessToken: string) {
    return this.http.get<{ aiConfigured: boolean }>('/route-stops/config', { signal, accessToken });
  }

  voiceConfig(signal: AbortSignal, accessToken: string) {
    return this.http.get<{ available: boolean }>('/voice/config', { signal, accessToken });
  }

  /** Gửi âm thanh WAV 16 kHz mono (xem voiceAudio.ts) và nhận văn bản. */
  transcribe(audio: Blob, signal: AbortSignal, accessToken: string) {
    return this.http.post<{ text: string }>('/voice/transcribe', audio, {
      signal,
      accessToken,
      headers: { 'Content-Type': 'audio/wav' },
    });
  }
}

export const assistantApi = new AssistantApiClient(httpClient);
