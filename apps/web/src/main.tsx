import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { isNightTime } from './features/map/hooks/useMapAppearance';
import { ErrorBoundary } from './app/shell/ErrorBoundary';
import { AuthProvider } from './features/auth/context/AuthProvider';
import { PushSignOutCleanup } from './features/notifications/components/PushSignOutCleanup';
import { RecentPlacesProvider } from './features/places/context/RecentPlacesProvider';
import { I18nProvider, useI18n } from './shared/i18n/I18nProvider';
import './app/styles.css';

const AuthPage = lazy(() =>
  import('./features/auth/components/AuthPage').then((module) => ({ default: module.AuthPage })),
);
const isLoginPage = window.location.pathname.replace(/\/+$/, '') === '/login';

function LoginLoading() {
  const { t } = useI18n();
  return (
    <main
      className={`${isNightTime() ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'} grid min-h-dvh place-items-center text-sm`}
      role="status"
    >
      {t('Đang mở trang đăng nhập…')}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          {/* Gỡ push khi đăng xuất, kể cả ở trang /login (không dựng App). */}
          <PushSignOutCleanup />
          {isLoginPage ? (
            <Suspense fallback={<LoginLoading />}>
              <AuthPage />
            </Suspense>
          ) : (
            <RecentPlacesProvider>
              <App />
            </RecentPlacesProvider>
          )}
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
