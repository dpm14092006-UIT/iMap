import { Component, type ErrorInfo, type ReactNode } from 'react';
import { scheduledMapLayer } from '../../features/map/hooks/useTimeBasedMapLayer';
import { readLanguage, translate } from '../../shared/i18n/translate';
import { formatErrorReport } from './errorReport';

declare const __APP_BUILD_VERSION__: string;

type ErrorBoundaryState = { failed: boolean; report: string; copied: boolean };
const t = (message: string) => {
  try {
    return translate(readLanguage(window.localStorage), message);
  } catch {
    return translate('vi', message);
  }
};

/** Chặn lỗi render để người dùng thấy lời nhắn và nút tải lại thay vì màn hình trắng. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, report: '', copied: false };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi giao diện chưa được xử lý', error, info.componentStack);
    try {
      this.setState({
        report: formatErrorReport(error, info.componentStack, {
          appVersion: typeof __APP_BUILD_VERSION__ === 'string' ? __APP_BUILD_VERSION__ : 'dev',
          path: window.location.pathname,
          userAgent: navigator.userAgent,
          time: new Date(),
        }),
      });
    } catch {
      // Giữ màn hình tải lại nếu không đọc được chi tiết của giá trị bị ném.
    }
  }

  private copyReport = async () => {
    try {
      await navigator.clipboard.writeText(this.state.report);
      this.setState({ copied: true });
    } catch {
      // Trình duyệt chặn clipboard: người dùng vẫn chọn chữ trong khung để sao chép tay hoặc chụp màn hình.
    }
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={scheduledMapLayer() === 'dark' ? 'dark' : ''}>
        <main
          className={`grid min-h-dvh place-items-center bg-slate-50 px-6 text-center text-ink dark:bg-slate-900 dark:text-slate-100`}
          role="alert"
        >
          <div className="min-w-0 w-full max-w-sm py-6">
            <h1 className="text-xl font-bold tracking-tight">{t('Đã có lỗi xảy ra')}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {t(
                'Ứng dụng gặp sự cố khi hiển thị. Tải lại trang để tiếp tục; các tuyến đã lưu của bạn vẫn còn.',
              )}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
            >
              {t('Tải lại trang')}
            </button>
            {this.state.report && (
              <details className="mt-5 text-left text-xs text-slate-600 dark:text-slate-400">
                <summary className="cursor-pointer py-2 text-center font-semibold">
                  {t('Chi tiết lỗi')}
                </summary>
                <p className="mt-2 leading-5">
                  {t('Chụp màn hình hoặc sao chép nội dung này gửi cho nhóm phát triển.')}
                </p>
                <pre className="mt-2 max-h-60 select-text overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/5 p-3 text-[11px] leading-5 dark:bg-white/5">
                  {this.state.report}
                </pre>
                <button
                  type="button"
                  onClick={() => void this.copyReport()}
                  className="mt-2 min-h-9 w-full rounded-lg text-xs font-semibold text-brand-700 ring-1 ring-brand-300 transition hover:bg-brand-50 dark:text-brand-200 dark:ring-indigo-300/40 dark:hover:bg-white/5"
                >
                  {this.state.copied ? t('Đã sao chép') : t('Sao chép chi tiết lỗi')}
                </button>
              </details>
            )}
          </div>
        </main>
      </div>
    );
  }
}
