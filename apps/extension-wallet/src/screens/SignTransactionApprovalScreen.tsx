import React from 'react';
import { useSearchParams } from 'react-router-dom';

function useRequestId(propsRequestId?: string): string | null {
  const [searchParams] = useSearchParams();

  if (propsRequestId) return propsRequestId;
  const fromUrl = searchParams.get('requestId');
  if (fromUrl) return fromUrl;
  const fromWindow = new URLSearchParams(window.location.search).get('requestId');
  return fromWindow;
}

export function SignTransactionApprovalScreen({
  requestId: propRequestId,
  title = 'Sign Transaction',
  subtitle = 'Review and approve the transaction',
  description = 'A dApp is requesting to sign a transaction. Approve only if you trust the source.',
}: {
  requestId?: string;
  title?: string;
  subtitle?: string;
  description?: string;
}) {
  const requestId = useRequestId(propRequestId);
  const [done, setDone] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  function sendToBackground(action: 'approve' | 'reject') {
    if (!requestId) return;
    setSubmitting(true);
    chrome.runtime.sendMessage(
      { type: action === 'approve' ? 'APPROVE_SIGN_REQUEST' : 'REJECT_SIGN_REQUEST', requestId },
      () => {
        setSubmitting(false);
        setDone(true);
      }
    );
  }

  if (!requestId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Invalid Request</h1>
          <p className="mt-2 text-sm text-muted-foreground">No request ID provided.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Request Processed</h1>
          <p className="mt-2 text-sm text-muted-foreground">The sign request has been processed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-gradient-to-br from-primary to-purple-800 px-5 pb-6 pt-8 text-white">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-white/70">{subtitle}</p>
      </header>
      <main className="flex-1 space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Request</h2>
          <p className="mt-2 text-sm text-muted-foreground">ID: {requestId}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </section>
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-50"
            disabled={submitting}
            onClick={() => sendToBackground('reject')}
            type="button"
          >
            Reject
          </button>
          <button
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            disabled={submitting}
            onClick={() => sendToBackground('approve')}
            type="button"
          >
            Approve
          </button>
        </div>
      </main>
    </div>
  );
}
