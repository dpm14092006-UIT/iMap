import type { TrafficReportDto } from '@routetwin/shared';

/** Báo cho các xe đang đi trên tuyến có sự cố vừa được báo cáo (Web Push, …). */
export interface TrafficAlertNotifier {
  notifyNewReport(report: TrafficReportDto): Promise<void>;
}

/** Dùng khi chưa cấu hình Web Push: không gửi gì, cảnh báo vẫn có qua Realtime trong app. */
export class NoopTrafficAlertNotifier implements TrafficAlertNotifier {
  async notifyNewReport(): Promise<void> {}
}
