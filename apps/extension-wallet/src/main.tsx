import React from 'react';
import ReactDOM from 'react-dom/client';
import { NotificationProvider } from '@ancore/ui-kit';
import { ExtensionRouter } from './router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <ExtensionRouter />
    </NotificationProvider>
  </React.StrictMode>
);
