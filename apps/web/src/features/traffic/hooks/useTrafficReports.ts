import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrafficReportBounds, TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { trafficApi, trafficPhotos, vietnamBounds } from '../api/trafficApi';
import { getSupabaseClient } from '../../auth/services/supabaseClient';

export type RealtimeTrafficReport = Pick<
  TrafficReportDto,
  'id' | 'incidentType' | 'severity' | 'vehicleScope' | 'lat' | 'lng' | 'status' | 'version'
>;

function parseRealtimeReport(value: unknown): RealtimeTrafficReport | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const validIncidentTypes = ['traffic_jam', 'accident', 'construction', 'flood', 'road_closure', 'obstacle'];
  const vehicleScope = payload.vehicleScope ?? 'both';
  if (
    typeof payload.id !== 'string' ||
    !validIncidentTypes.includes(String(payload.incidentType)) ||
    !['low', 'medium', 'high'].includes(String(payload.severity)) ||
    !['car', 'motorcycle', 'both'].includes(String(vehicleScope)) ||
    typeof payload.lat !== 'number' ||
    payload.lat < -90 ||
    payload.lat > 90 ||
    typeof payload.lng !== 'number' ||
    payload.lng < -180 ||
    payload.lng > 180 ||
    !['active', 'cleared', 'expired'].includes(String(payload.status))
  ) {
    return null;
  }
  return {
    id: payload.id,
    incidentType: payload.incidentType as TrafficReportDto['incidentType'],
    severity: payload.severity as TrafficReportDto['severity'],
    vehicleScope: vehicleScope as TrafficReportDto['vehicleScope'],
    lat: payload.lat,
    lng: payload.lng,
    status: payload.status as TrafficReportDto['status'],
    version: typeof payload.version === 'number' ? payload.version : 1,
  };
}

export function useTrafficReports(
  accessToken: string | null,
  userId: string | null,
  bounds: TrafficReportBounds = vietnamBounds,
  realtimeEnabled = false,
  onRealtimeReport?: (report: RealtimeTrafficReport) => void,
) {
  const [reports, setReports] = useState<TrafficReportDto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchBounds, setSearchBounds] = useState(bounds);
  const { minLat, minLng, maxLat, maxLng } = bounds;
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchBounds({ minLat, minLng, maxLat, maxLng }), 350);
    return () => window.clearTimeout(timer);
  }, [minLat, minLng, maxLat, maxLng]);
  const latestRequest = useRef(0);
  const onRealtimeReportRef = useRef(onRealtimeReport);
  useEffect(() => {
    onRealtimeReportRef.current = onRealtimeReport;
  }, [onRealtimeReport]);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    if (searchBounds.maxLat - searchBounds.minLat > 2 || searchBounds.maxLng - searchBounds.minLng > 2) {
      setReports([]);
      setError('Phóng to khu vực cần xem để tải báo cáo giao thông.');
      setLoading(false);
      return;
    }
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

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!realtimeEnabled) return;
    let active = true;
    let removeChannel: (() => void) | undefined;
    void getSupabaseClient()
      .then((client) => {
        if (!active || !client) return;
        const channel = client
          .channel('traffic:reports', { config: { private: false } })
          .on('broadcast', { event: 'traffic_report_changed' }, (message) => {
            const report = parseRealtimeReport(message.payload);
            if (report) onRealtimeReportRef.current?.(report);
            void refreshRef.current();
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void refreshRef.current();
          });
        removeChannel = () => {
          void client.removeChannel(channel);
        };
      })
      .catch(() => undefined);
    return () => {
      active = false;
      removeChannel?.();
    };
  }, [realtimeEnabled]);

  const create = useCallback(
    async (input: TrafficReportInput, photo?: File) => {
      if (!accessToken) throw new Error('Đăng nhập để gửi báo cáo giao thông.');
      let imagePath: string | undefined;
      if (photo) {
        if (!userId) throw new Error('Không xác định được tài khoản để lưu ảnh.');
        imagePath = await trafficPhotos.upload(photo, userId);
      }
      let report: TrafficReportDto;
      try {
        report = await trafficApi.create({ ...input, ...(imagePath ? { imagePath } : {}) }, accessToken);
      } catch (error) {
        if (imagePath) await trafficPhotos.remove(imagePath).catch(() => undefined);
        throw error;
      }
      await refresh();
      return report;
    },
    [accessToken, userId, refresh],
  );

  const clearance = useCallback(
    async (id: string, state: 'clear' | 'still_active') => {
      if (!accessToken) throw new Error('Đăng nhập để xác minh báo cáo giao thông.');
      const report = await trafficApi.clearance(id, state, accessToken);
      await refresh();
      return report;
    },
    [accessToken, refresh],
  );

  return { reports, error, loading, refresh, create, clearance };
}
