import { Icon } from '../../../shared/ui/Icon';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type Props = {
  busy: boolean;
  error: string;
  isAuthenticated: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  onSignIn: () => void;
};

/** Mời bật thông báo khi đang có tuyến, để nhận cảnh báo sự cố kể cả khi tắt màn hình. */
export function PushPermissionCard({ busy, error, isAuthenticated, onEnable, onDismiss, onSignIn }: Props) {
  const { t } = useI18n();
  return (
    <div
      className="absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(420px,calc(100%-24px))] -translate-x-1/2 rounded-3xl bg-white p-4 text-ink shadow-float ring-1 ring-black/10 dark:bg-slate-900 dark:text-white dark:shadow-float-dark dark:ring-white/15 md:left-auto md:right-4 md:translate-x-0"
      role="dialog"
      aria-label={t('Bật thông báo giao thông')}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
          <Icon name="warning" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t('Nhận cảnh báo kẹt xe trên tuyến')}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {isAuthenticated
              ? t(
                  'Bật thông báo để được báo ngay khi có người báo cáo sự cố trên tuyến của bạn, kể cả khi đã tắt màn hình.',
                )
              : t(
                  'Đăng nhập rồi bật thông báo để được báo ngay khi có sự cố trên tuyến, kể cả khi đã tắt màn hình.',
                )}
          </p>
          {error && <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{t(error)}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={isAuthenticated ? onEnable : onSignIn}
              className="h-9 rounded-full bg-brand-gradient px-4 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? t('Đang bật…') : isAuthenticated ? t('Bật thông báo') : t('Đăng nhập')}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="h-9 rounded-full px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
            >
              {t('Để sau')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
