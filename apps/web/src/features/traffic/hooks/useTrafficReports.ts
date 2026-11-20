import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrafficReportBounds, TrafficReportDto, TrafficReportInput } from '@routetwin/shared';
import { trafficApi, trafficPhotos, vietnamBounds } from '../api/trafficApi';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import { debounce } from '../../../shared/async/debounce';
import { parseRealtimeReport, type RealtimeTrafficReport } from '../domain/realtimeReport';
import { canQueryTraffic, containsTrafficBounds, trafficQueryBounds } from '../domain/trafficQueryBounds';

export type { RealtimeTrafficReport } from '../domain/realtimeReport';

/** Gom các sự kiện realtime đến dồn dập trong khoảng này (ms) thành một lần tải lại danh sách. */
const REALTIME_REFRESH_DEBOUNCE_MS = 500;

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
  const [searchBounds, setSearchBounds] = useState(() => trafficQueryBounds(bounds));
  const viewportRef = useRef(bounds);
  viewportRef.current = bounds;
  // The RPC returns at most 200 rows. A full buffer must fall back to the visible area,
  // otherwise reports outside the screen could crowd out reports inside it.
  const denseCoverage = useRef<TrafficReportBounds | null>(null);
  const { minLat, minLng, maxLat, maxLng } = bounds;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const viewport = { minLat, minLng, maxLat, maxLng };
      const dense = denseCoverage.current;
      const inDenseArea = dense !== null && containsTrafficBounds(dense, viewport);
      if (!inDenseArea) denseCoverage.current = null;
      setSearchBounds((current) => trafficQueryBounds(viewport, current, !inDenseArea));
    }, 350);
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
    if (!canQueryTraffic(searchBounds)) {
      setReports([]);
      setError('Phóng to khu vực cần xem để tải báo cáo giao thông.');
      setLoading(false);
      return;
    }
    try {
      const nextReports = await trafficApi.list(accessToken ?? undefined, searchBounds);
      if (requestId !== latestRequest.current) return;
      const viewport = viewportRef.current;
      const isBuffered = Object.entries(viewport).some(
        ([key, value]) => value !== searchBounds[key as keyof TrafficReportBounds],
      );
      if (
        nextReports.length >= 200 &&
        canQueryTraffic(viewport) &&
        containsTrafficBounds(searchBounds, viewport) &&
        isBuffered
      ) {
        denseCoverage.current = searchBounds;
        setSearchBounds({ ...viewport });
        return;
      }
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
    // Mỗi sự kiện từng tải lại toàn bộ báo cáo trong khung bản đồ; nhiều người cùng báo/xác nhận thì
    // gọi API liên tục. Gom các sự kiện trong REALTIME_REFRESH_DEBOUNCE_MS thành một lần tải.
    const scheduleRefresh = debounce(() => void refreshRef.current(), REALTIME_REFRESH_DEBOUNCE_MS);
    void getSupabaseClient()
      .then((client) => {
        if (!active || !client) return;
        const channel = client
          .channel('traffic:reports', { config: { private: false } })
          .on('broadcast', { event: 'traffic_report_changed' }, (message) => {
            const report = parseRealtimeReport(message.payload);
            // Cảnh báo trên tuyến vẫn báo ngay; chỉ việc tải lại danh sách được gom.
            if (report) onRealtimeReportRef.current?.(report);
            scheduleRefresh();
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
      scheduleRefresh.cancel();
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
