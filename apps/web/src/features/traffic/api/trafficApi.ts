import type { TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { apiRequest } from '../../../shared/api/httpClient';
export const trafficApi = {
  list:() => apiRequest<TrafficReportDto[]>('/traffic-reports'),
  create:(input:TrafficReportInput) => apiRequest<TrafficReportDto>('/traffic-reports',{method:'POST',body:JSON.stringify(input)}),
  clearance:(id:string,state:'clear'|'still_active')=>apiRequest<TrafficReportDto>(`/traffic-reports/${id}/clearance`,{method:'POST',body:JSON.stringify({state})}),
};
