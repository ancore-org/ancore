import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from '@ancore/ui-kit';
import { ExtensionAuthProvider } from '../router/AuthGuard';
import { ApprovalApp } from '../screens/ApprovalApp';
import '../i18n';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <ExtensionAuthProvider>
          <ApprovalApp />
        </ExtensionAuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);
