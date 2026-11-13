import { Component, type ErrorInfo, type ReactNode } from 'react';
import { scheduledMapLayer } from '../../features/map/hooks/useTimeBasedMapLayer';
import { readLanguage, translate } from '../../shared/i18n/I18nProvider';

type ErrorBoundaryState = { failed: boolean };
const t = (message: string) => {
  try {
    return translate(readLanguage(window.localStorage), message);
  } catch {
    return translate('vi', message);
  }
};

/** Chặn lỗi render để người dùng thấy lời nhắn và nút tải lại thay vì màn hình trắng. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi giao diện chưa được xử lý', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={scheduledMapLayer() === 'dark' ? 'dark' : ''}>
        <main
          className={`grid min-h-dvh place-items-center bg-slate-50 px-6 text-center text-ink dark:bg-slate-900 dark:text-slate-100`}
          role="alert"
        >
          <div className="max-w-sm">
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
          </div>
        </main>
      </div>
    );
  }
}
