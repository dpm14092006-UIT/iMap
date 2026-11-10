import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrafficReportBounds, TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { trafficApi, vietnamBounds } from '../api/trafficApi';
import { supabaseClient } from '../../auth/services/supabaseClient';

export function useTrafficReports(accessToken: string | null, userId: string | null, bounds: TrafficReportBounds = vietnamBounds) {
  const [reports, setReports] = useState<TrafficReportDto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchBounds, setSearchBounds] = useState(bounds);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchBounds(bounds), 350);
    return () => window.clearTimeout(timer);
  }, [bounds.minLat, bounds.minLng, bounds.maxLat, bounds.maxLng]);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const nextReports = await trafficApi.list(accessToken ?? undefined, searchBounds);
      if (requestId !== latestRequest.current) return;
      setReports(nextReports);
      setError('');
    } catch (cause) {
      if (requestId !== latestRequest.current) return;
      setError(cause instanceof Error ? cause.message : 'Không kết nối được máy chủ giao thông.');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [accessToken, searchBounds]);

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

  const create = useCallback(async (input: TrafficReportInput, photo?: File) => {
    if (!accessToken) throw new Error('Đăng nhập để gửi báo cáo giao thông.');
    let imagePath: string | undefined;
    if (photo) {
      if (!userId) throw new Error('Không xác định được tài khoản để lưu ảnh.');
      imagePath = await trafficApi.uploadPhoto(photo, userId);
    }
    let report: TrafficReportDto;
    try {
      report = await trafficApi.create({ ...input, ...(imagePath ? { imagePath } : {}) }, accessToken);
    } catch (error) {
      if (imagePath) await trafficApi.removePhoto(imagePath).catch(() => undefined);
      throw error;
    }
    await refresh();
    return report;
  }, [accessToken, userId, refresh]);

  const clearance = useCallback(async (id: string, state: 'clear' | 'still_active') => {
    if (!accessToken) throw new Error('Đăng nhập để xác minh báo cáo giao thông.');
    const report = await trafficApi.clearance(id, state, accessToken);
    await refresh();
    return report;
  }, [accessToken, refresh]);

  return { reports, error, loading, refresh, create, clearance };
}
