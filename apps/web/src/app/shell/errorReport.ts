/** Thông tin môi trường đính kèm báo lỗi, để biết lỗi xảy ra ở bản nào, trang nào, trình duyệt nào. */
export type ErrorReportContext = {
  appVersion: string;
  /** Chỉ đường dẫn, không kèm tham số (?from=… có thể chứa vị trí của người dùng). */
  path: string;
  userAgent: string;
  time: Date;
};

const MAX_STACK_LINES = 6;
const MAX_COMPONENT_LINES = 4;

/** Giữ lại vài dòng đầu có ý nghĩa của stack (bỏ dòng trống). */
const firstLines = (text: string | null | undefined, count: number) =>
  (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);

/**
 * Nội dung báo lỗi ngắn gọn để người dùng chụp màn hình hoặc sao chép gửi nhóm phát triển.
 * Trước đây màn hình lỗi chỉ ghi "Đã có lỗi xảy ra", không ai biết nguyên nhân nếu không mở Console.
 */
export function formatErrorReport(
  error: unknown,
  componentStack: string | null | undefined,
  context: ErrorReportContext,
): string {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? firstLines(error.stack, MAX_STACK_LINES + 1).slice(1) : [];
  const components = firstLines(componentStack, MAX_COMPONENT_LINES);
  return [
    `${name}: ${message}`,
    ...stack.map((line) => `  ${line}`),
    ...(components.length ? ['Component:', ...components.map((line) => `  ${line}`)] : []),
    `Phiên bản: ${context.appVersion}`,
    `Trang: ${context.path}`,
    `Thời điểm: ${context.time.toISOString()}`,
    `Trình duyệt: ${context.userAgent}`,
  ].join('\n');
}
