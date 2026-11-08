import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AuthProvider } from './features/auth/context/AuthProvider';
import 'leaflet/dist/leaflet.css';
import './app/styles.css';
const AuthPage = lazy(() => import('./features/auth/components/AuthPage').then((module) => ({ default: module.AuthPage })));
const isLoginPage = window.location.pathname.replace(/\/+$/, '') === '/login';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthProvider>{isLoginPage
    ? <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-slate-50 text-sm text-slate-600" role="status">Đang mở trang đăng nhập…</main>}><AuthPage /></Suspense>
    : <App />}</AuthProvider></React.StrictMode>,
);
