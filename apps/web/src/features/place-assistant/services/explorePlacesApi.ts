import type { ExplorePlacesRequest, ExplorePlacesResponse } from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';
export const explorePlaces = (request: ExplorePlacesRequest, signal: AbortSignal) => apiRequest<ExplorePlacesResponse>('/route-stops/explore', { method: 'POST', body: JSON.stringify(request), signal });
