// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { NotificationToastProvider } from './contexts/NotificationToastContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <NotificationToastProvider>
      <App />
    </NotificationToastProvider>
  </React.StrictMode>,
);
