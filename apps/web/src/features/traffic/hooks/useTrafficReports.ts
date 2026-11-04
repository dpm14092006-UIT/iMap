import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { trafficApi } from '../api/trafficApi';
import { supabaseClient } from '../../auth/services/supabaseClient';

export function useTrafficReports(accessToken: string | null) {
  const [reports, setReports] = useState<TrafficReportDto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const nextReports = await trafficApi.list(accessToken ?? undefined);
      if (requestId !== latestRequest.current) return;
      setReports(nextReports);
      setError('');
    } catch (cause) {
      if (requestId !== latestRequest.current) return;
      setError(cause instanceof Error ? cause.message : 'Không kết nối được máy chủ giao thông.');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const client = supabaseClient;
    if (!client) return;
    const channel = client.channel('traffic:reports', { config: { private: false } })
      .on('broadcast', { event: 'traffic_report_changed' }, () => { void refresh(); })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refresh();
      });
    return () => { void client.removeChannel(channel); };
  }, [refresh]);

  const create = useCallback(async (input: TrafficReportInput) => {
    if (!accessToken) throw new Error('Đăng nhập để gửi báo cáo giao thông.');
    const report = await trafficApi.create(input, accessToken);
    await refresh();
    return report;
  }, [accessToken, refresh]);

  const clearance = useCallback(async (id: string, state: 'clear' | 'still_active') => {
    if (!accessToken) throw new Error('Đăng nhập để xác minh báo cáo giao thông.');
    const report = await trafficApi.clearance(id, state, accessToken);
    await refresh();
    return report;
  }, [accessToken, refresh]);

  return { reports, error, loading, refresh, create, clearance };
}
