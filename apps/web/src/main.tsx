import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { scheduledMapLayer } from './features/map/hooks/useTimeBasedMapLayer';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { AuthProvider } from './features/auth/context/AuthProvider';
import { I18nProvider, useI18n } from './shared/i18n/I18nProvider';
import 'leaflet/dist/leaflet.css';
import './app/styles.css';

const AuthPage = lazy(() =>
  import('./features/auth/components/AuthPage').then((module) => ({ default: module.AuthPage })),
);
const isLoginPage = window.location.pathname.replace(/\/+$/, '') === '/login';

function LoginLoading() {
  const { t } = useI18n();
  return (
    <main
      className={`${scheduledMapLayer() === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'} grid min-h-dvh place-items-center text-sm`}
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
          {isLoginPage ? (
            <Suspense fallback={<LoginLoading />}>
              <AuthPage />
            </Suspense>
          ) : (
            <App />
          )}
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
