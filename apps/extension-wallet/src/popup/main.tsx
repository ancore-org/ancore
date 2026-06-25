import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from '@ancore/ui-kit';
import { ExtensionRouter } from '../router';
import { ExtensionAuthProvider } from '../router/AuthGuard';
import { ApprovalApp } from '../screens/ApprovalApp';
import '../i18n';
import '../index.css';

const hasApprovalRequest = new URLSearchParams(window.location.search).has('requestId');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {hasApprovalRequest ? (
      <BrowserRouter>
        <NotificationProvider>
          <ExtensionAuthProvider>
            <ApprovalApp />
          </ExtensionAuthProvider>
        </NotificationProvider>
      </BrowserRouter>
    ) : (
      <ExtensionRouter />
    )}
  </React.StrictMode>
);
