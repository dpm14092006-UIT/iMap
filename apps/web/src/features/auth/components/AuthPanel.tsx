import { SheetPanel } from '../../../app/layout/SheetPanel';
import { useAuth } from '../context/AuthProvider';
import { AccountForm } from './AccountForm';
import { useI18n } from '../../../shared/i18n/I18nProvider';

type AuthPanelProps = { onClose: () => void };

export function AuthPanel({ onClose }: AuthPanelProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <SheetPanel
      eyebrow={t('TÀI KHOẢN')}
      title={user ? t('Tài khoản của bạn') : t('Đăng nhập')}
      icon="pin"
      onClose={onClose}
    >
      <AccountForm />
      <a
        href="/login"
        className="mt-4 block py-2 text-center text-xs font-semibold text-brand-700 dark:text-indigo-300 hover:underline"
      >
        {t('Mở trang tài khoản')}
      </a>
    </SheetPanel>
  );
}
