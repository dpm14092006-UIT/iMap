import { useCallback, useEffect, useState } from 'react';
import type { TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { trafficApi } from '../api/trafficApi';
export function useTrafficReports() {
  const [reports,setReports] = useState<TrafficReportDto[]>([]);
  const [error,setError] = useState<string>('');
  const refresh = useCallback(async()=>{
    try { setReports(await trafficApi.list());setError(''); }
    catch(e) {setError(e instanceof Error?e.message:'Không kết nối API');}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const create = async (input:TrafficReportInput)=>{await trafficApi.create(input);await refresh();};
  const clearance = async (id:string,state:'clear'|'still_active')=>{await trafficApi.clearance(id,state);await refresh();};
  return {reports,error,refresh,create,clearance};
}
