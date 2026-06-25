import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from '@ancore/ui-kit';
import { ExtensionAuthProvider } from '../router/AuthGuard';
import { SignTransactionApprovalScreen } from '../screens/SignTransactionApprovalScreen';
import '../i18n';
import '../index.css';

function SidePanelApp() {
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get('requestId');

  if (!requestId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center text-sm text-muted-foreground">
        No approval request found.
      </div>
    );
  }

  return <SignTransactionApprovalScreen requestId={requestId} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <ExtensionAuthProvider>
          <SidePanelApp />
        </ExtensionAuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);
