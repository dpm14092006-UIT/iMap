import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AuthProvider } from './features/auth/context/AuthProvider';
import 'leaflet/dist/leaflet.css';
import './app/styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>);
