import React from 'react';
import { ShieldCheck, X, Globe } from 'lucide-react';
import { sanitizeText, sanitizeUrl } from '@/utils/sanitize';

export interface GrantAccessScreenProps {
  requestId?: string;
  dappName?: string;
  origin?: string;
  iconUrl?: string;
  description?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export function GrantAccessScreen({
  requestId: propRequestId,
  dappName: propName,
  origin: propOrigin,
  iconUrl: propIcon,
  description: propDesc,
  onApprove,
  onReject,
}: GrantAccessScreenProps) {
  const [params] = React.useState(() => new URLSearchParams(window.location.search));
  const requestId = propRequestId || params.get('requestId');
  const rawName = propName || params.get('dappName') || params.get('name') || 'Unknown Application';
  const rawOrigin = propOrigin || params.get('origin') || '';
  const rawIcon = propIcon || params.get('iconUrl') || params.get('icon') || '';
  const rawDesc =
    propDesc ||
    params.get('description') ||
    'This application is requesting permission to view your account address.';

  // Sanitize all untrusted incoming metadata
  const sanitizedName = sanitizeText(rawName);
  const sanitizedOrigin = sanitizeText(rawOrigin);
  const sanitizedIcon = sanitizeUrl(rawIcon);
  const sanitizedDesc = sanitizeText(rawDesc);

  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  function sendToBackground(action: 'approve' | 'reject') {
    if (!requestId) {
      if (action === 'approve') onApprove?.();
      else onReject?.();
      return;
    }

    setSubmitting(true);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        {
          type: action === 'approve' ? 'APPROVE_ACCESS_REQUEST' : 'REJECT_ACCESS_REQUEST',
          requestId,
        },
        () => {
          setSubmitting(false);
          setDone(true);
          if (action === 'approve') onApprove?.();
          else onReject?.();
        }
      );
    } else {
      setSubmitting(false);
      setDone(true);
      if (action === 'approve') onApprove?.();
      else onReject?.();
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Request Processed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The access request has been processed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-sheet">
      <header className="wallet-header">
        <div>
          <p className="wallet-kicker">Connection Request</p>
          <h1 className="wallet-title mt-1">Grant Access</h1>
        </div>
        <button
          aria-label="Reject request"
          className="wallet-icon-btn"
          disabled={submitting}
          onClick={() => sendToBackground('reject')}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col px-5 pb-6 pt-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 overflow-hidden">
          {sanitizedIcon ? (
            <img
              src={sanitizedIcon}
              alt={sanitizedName}
              className="h-12 w-12 object-contain"
              onError={(e) => {
                // Hide broken image on load failure
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <ShieldCheck className="h-8 w-8" strokeWidth={1.8} />
          )}
        </div>

        <div className="mt-4 text-center">
          <h2
            data-testid="dapp-name"
            className="text-[20px] font-semibold tracking-[-0.02em] text-foreground"
          >
            {sanitizedName}
          </h2>
          {sanitizedOrigin && (
            <p
              data-testid="dapp-origin"
              className="mt-1 flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted-foreground"
            >
              <Globe className="h-3.5 w-3.5 opacity-70" />
              <span>{sanitizedOrigin}</span>
            </p>
          )}
          <p
            data-testid="dapp-description"
            className="mx-auto mt-3 max-w-[290px] text-[13px] leading-relaxed text-muted-foreground"
          >
            {sanitizedDesc}
          </p>
        </div>

        <section className="wallet-card mt-6">
          <div className="text-xs space-y-2">
            <p className="font-semibold text-foreground">Requested Permissions:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>View your account public address</li>
              <li>Request transaction signatures for user confirmation</li>
            </ul>
          </div>
          {requestId && (
            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[11px] text-muted-foreground font-mono">
              <span>Request ID</span>
              <span className="truncate max-w-[160px]">{requestId}</span>
            </div>
          )}
        </section>

        <div className="mt-auto space-y-3 pt-6">
          <button
            data-testid="approve-access-btn"
            className="wallet-pill-btn"
            disabled={submitting}
            onClick={() => sendToBackground('approve')}
            type="button"
          >
            Connect
          </button>
          <button
            data-testid="reject-access-btn"
            className="w-full py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            disabled={submitting}
            onClick={() => sendToBackground('reject')}
            type="button"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}
