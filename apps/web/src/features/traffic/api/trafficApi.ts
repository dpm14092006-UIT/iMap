import type { TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';
import type { FeatureCollection, Point } from 'geojson';

export const hcmBounds = { minLat: 10.0, minLng: 106.0, maxLat: 11.25, maxLng: 107.25 };
export type TrafficFeature = { incidentType: string; severity: string; status: string; createdAt: string; expiresAt: string; version: number; note?: string };

function boundsQuery() {
  const query = new URLSearchParams(Object.entries(hcmBounds).map(([key, value]) => [key, String(value)]));
  return query.toString();
}

export const trafficApi = {
  list:(accessToken?:string) => apiRequest<TrafficReportDto[]>(`/traffic-reports?${boundsQuery()}`, undefined, accessToken),
  geojson:(accessToken?:string) => apiRequest<FeatureCollection<Point, TrafficFeature>>(`/traffic-reports/geojson?${boundsQuery()}`, undefined, accessToken),
  create:(input:TrafficReportInput, accessToken:string) => apiRequest<TrafficReportDto>('/traffic-reports',{method:'POST',body:JSON.stringify(input)},accessToken),
  clearance:(id:string,state:'clear'|'still_active',accessToken:string)=>apiRequest<TrafficReportDto>(`/traffic-reports/${id}/clearance`,{method:'POST',body:JSON.stringify({state})},accessToken),
};
