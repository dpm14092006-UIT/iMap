import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { scheduledMapLayer } from './features/map/hooks/useTimeBasedMapLayer';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { AuthProvider } from './features/auth/context/AuthProvider';
import 'leaflet/dist/leaflet.css';
import './app/styles.css';

const AuthPage = lazy(() =>
  import('./features/auth/components/AuthPage').then((module) => ({ default: module.AuthPage })),
);
const isLoginPage = window.location.pathname.replace(/\/+$/, '') === '/login';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {isLoginPage ? (
          <Suspense
            fallback={
              <main
                className={`${scheduledMapLayer() === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'} grid min-h-dvh place-items-center text-sm`}
                role="status"
              >
                Đang mở trang đăng nhập…
              </main>
            }
          >
            <AuthPage />
          </Suspense>
        ) : (
          <App />
        )}
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
