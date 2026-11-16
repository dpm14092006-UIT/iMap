import type { TrafficReportInput, TrafficReportDto } from '@routetwin/shared';
import type { TrafficReportRepository } from '../ports/TrafficReportRepository.js';
import { NoopTrafficAlertNotifier, type TrafficAlertNotifier } from '../ports/TrafficAlertNotifier.js';

/** Gửi thông báo đẩy tối đa bao lâu trước khi trả kết quả cho người báo cáo. */
const NOTIFY_TIMEOUT_MS = 4_000;

export class CreateTrafficReportUseCase {
  constructor(
    private readonly repository: TrafficReportRepository,
    private readonly notifier: TrafficAlertNotifier = new NoopTrafficAlertNotifier(),
  ) {}

  async execute(input: TrafficReportInput, accessToken: string): Promise<TrafficReportDto> {
    const report = await this.repository.create(input, accessToken);
    // Chờ gửi xong (có giới hạn) vì trên serverless tác vụ chạy nền có thể bị dừng sau khi trả response.
    // Lỗi gửi thông báo không được làm hỏng việc lưu báo cáo.
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      this.notifier.notifyNewReport(report).catch((error: unknown) => {
        console.error('Traffic push notification failed', {
          reportId: report.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, NOTIFY_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer);
    return report;
  }
}
