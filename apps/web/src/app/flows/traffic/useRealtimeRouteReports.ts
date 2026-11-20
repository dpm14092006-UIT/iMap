import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RoutePlan } from '../../../features/routing/types';
import type { RealtimeTrafficReport } from '../../../features/traffic/hooks/useTrafficReports';
import { parseRealtimeReport, pickCommunityCounts } from '../../../features/traffic/domain/realtimeReport';
import { ReportVersionGate } from '../../../features/traffic/domain/ReportVersionGate';
import { shouldNotifyTrafficReportOnRoute } from '../../../features/traffic/domain/routeTraffic';

/** Số báo cáo nhớ "đã báo" tối đa; vượt thì quên báo cáo cũ nhất. */
const MAX_REMEMBERED_REPORTS = 120;

export type RouteReportHandler = (report: RealtimeTrafficReport) => void;

/**
 * Cổng chung cho báo cáo mới đến từ Supabase Realtime và từ Web Push (qua service worker):
 * chỉ chuyển tiếp báo cáo nằm trên tuyến đang xem, mỗi phiên bản của báo cáo chỉ một lần.
 *
 * Nơi xử lý (`setHandler`) được gán sau, khi đã có hình học tuyến và hộp cảnh báo.
 */
export function useRealtimeRouteReports(route: RoutePlan | null) {
  const handler = useRef<RouteReportHandler | null>(null);
  const routeId = route?.id;
  const { gate } = useMemo(
    () => ({ routeId, gate: new ReportVersionGate(MAX_REMEMBERED_REPORTS) }),
    [routeId],
  );

  const onRealtimeTrafficReport = useCallback(
    (report: RealtimeTrafficReport) => {
      if (!handler.current || !route || !shouldNotifyTrafficReportOnRoute(route, report)) return;
      if (!gate.admit(report.id, report.version ?? 1)) return;
      handler.current(report);
    },
    [route, gate],
  );

  // Service worker chuyển Web Push (và cú bấm vào thông báo) cho app đang mở.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; report?: unknown } | null;
      if (data?.type !== 'traffic_alert') return;
      // Dữ liệu từ push là dữ liệu ngoài: kiểm tra trước khi dùng, giữ thêm số liệu cộng đồng (đã kiểm kiểu).
      const report = parseRealtimeReport(data.report);
      if (report) onRealtimeTrafficReport({ ...report, ...pickCommunityCounts(data.report as object) });
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [onRealtimeTrafficReport]);

  return {
    onRealtimeTrafficReport,
    setHandler: (next: RouteReportHandler) => {
      handler.current = next;
    },
  };
}
