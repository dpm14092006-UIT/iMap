import { useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nProvider';
import { useNightTime } from '../../map/hooks/useMapAppearance';
import { AccountForm } from './AccountForm';
import { AuthLayout } from './AuthLayout';

export function AuthPage() {
  const isDark = useNightTime();
  const { language, setLanguage, t } = useI18n();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'iMap';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className={isDark ? 'dark' : ''}>
      <main className="imap-auth-canvas">
        <AuthLayout language={language} onLanguageChange={setLanguage} backLabel={t('Về bản đồ')}>
          <AccountForm showHeading />
        </AuthLayout>
      </main>
    </div>
  );
}
