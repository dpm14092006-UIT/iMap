import type { ExplorePlacesRequest, ExplorePlacesResponse } from '@routetwin/shared';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';

/** Client tìm địa điểm theo nhu cầu dành cho thành viên. */
class AssistantApiClient {
  constructor(private readonly http: HttpClient) {}

  explorePlaces(request: ExplorePlacesRequest, signal: AbortSignal, accessToken: string) {
    return this.http.post<ExplorePlacesResponse>('/route-stops/explore', request, { signal, accessToken });
  }

  routeStopsConfig(signal: AbortSignal, accessToken: string) {
    return this.http.get<{ aiConfigured: boolean }>('/route-stops/config', { signal, accessToken });
  }
}

export const assistantApi = new AssistantApiClient(httpClient);
