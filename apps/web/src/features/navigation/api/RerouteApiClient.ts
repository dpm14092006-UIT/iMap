import type { RerouteRequest, RerouteResult } from '@routetwin/shared';
import type { HttpClient } from '../../../shared/api/HttpClient';
import { httpClient } from '../../../shared/api/HttpClient';

/** Client cho POST /api/routes/reroute: tính lại tuyến từ vị trí hiện tại, tránh các sự cố trong `avoid`. */
export class RerouteApiClient {
  constructor(private readonly http: HttpClient) {}

  reroute(request: RerouteRequest): Promise<RerouteResult> {
    return this.http.post<RerouteResult>('/routes/reroute', request);
  }
}

export const rerouteApi = new RerouteApiClient(httpClient);
