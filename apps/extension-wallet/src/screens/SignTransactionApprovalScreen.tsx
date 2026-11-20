import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHardwareWalletStore } from '@/stores/hardware-wallet';
import { ShieldCheck, X } from 'lucide-react';
import {
  sanitizeString,
  sanitizeOrigin,
  sanitizeContractId,
  sanitizeMethodName,
  sanitizePermissions,
} from '@/utils/sanitize';

function useRequestId(propsRequestId?: string): string | null {
  const [searchParams] = useSearchParams();

  if (propsRequestId) return propsRequestId;
  const fromUrl = searchParams.get('requestId');
  if (fromUrl) return fromUrl;
  const fromWindow = new URLSearchParams(window.location.search).get('requestId');
  return fromWindow;
}

export interface SignTransactionApprovalScreenProps {
  requestId?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  origin?: string;
  dAppName?: string;
  contractId?: string;
  methodName?: string;
  requestedScopes?: string[];
  /** Determines which message types to send to the background on approve/reject. */
  requestType?: 'sign-transaction' | 'sign-auth-entry';
}

export function SignTransactionApprovalScreen({
  requestId: propRequestId,
  title = 'Sign Transaction',
  subtitle = 'Review and approve the transaction',
  description = 'A dApp is requesting to sign a transaction. Approve only if you trust the source.',
  origin,
  dAppName,
  contractId,
  methodName,
  requestedScopes,
  requestType = 'sign-transaction',
}: SignTransactionApprovalScreenProps) {
  const rawRequestId = useRequestId(propRequestId);
  const requestId = rawRequestId ? sanitizeString(rawRequestId, 64) : null;
  const safeTitle = sanitizeString(title, 80);
  const safeSubtitle = sanitizeString(subtitle, 120);
  const safeDescription = sanitizeString(description, 300);
  const safeDAppName = dAppName ? sanitizeString(dAppName, 80) : undefined;
  const safeOrigin = origin ? sanitizeOrigin(origin) : undefined;
  const safeContractId = contractId ? sanitizeContractId(contractId) : undefined;
  const safeMethodName = methodName ? sanitizeMethodName(methodName) : undefined;
  const safeScopes = requestedScopes ? sanitizePermissions(requestedScopes) : undefined;
  const [done, setDone] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [devicePrompt, setDevicePrompt] = React.useState(false);
  const signerMode = useHardwareWalletStore((s) => s.signerMode);
  const ledgerPublicKey = useHardwareWalletStore((s) => s.ledgerPublicKey);
  const hardwarePreferred = signerMode === 'ledger' && Boolean(ledgerPublicKey);

  const approveRef = React.useRef<HTMLButtonElement>(null);

  // Auto-focus primary action on mount
  React.useEffect(() => {
    approveRef.current?.focus();
  }, []);

  // Escape → reject (no-op while submitting to avoid double-send)
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) {
        sendToBackground('reject');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting]); // eslint-disable-line react-hooks/exhaustive-deps

  function sendToBackground(action: 'approve' | 'reject') {
    if (!requestId) return;
    setSubmitting(true);
    if (action === 'approve' && hardwarePreferred) {
      setDevicePrompt(true);
    }
    const approveType =
      requestType === 'sign-auth-entry' ? 'APPROVE_AUTH_ENTRY_REQUEST' : 'APPROVE_SIGN_REQUEST';
    const rejectType =
      requestType === 'sign-auth-entry' ? 'REJECT_AUTH_ENTRY_REQUEST' : 'REJECT_SIGN_REQUEST';
    chrome.runtime.sendMessage(
      { type: action === 'approve' ? approveType : rejectType, requestId },
      () => {
        setSubmitting(false);
        setDevicePrompt(false);
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
    <div className="wallet-sheet">
      <header className="wallet-header">
        <div>
          <p className="wallet-kicker">Approval request</p>
          <h1 className="wallet-title mt-1">{safeTitle}</h1>
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
      <main className="flex flex-1 flex-col px-5 pb-6 pt-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <div className="mt-6 text-center">
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
            {safeSubtitle}
          </h2>
          <p className="mx-auto mt-2 max-w-[290px] text-[13px] leading-5 text-muted-foreground">
            {safeDescription}
          </p>
        </div>

        <section className="wallet-card mt-8 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Request
            </span>
            <span className="max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-foreground">
              {requestId}
            </span>
          </div>

          {(safeDAppName || safeOrigin) && (
            <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                dApp Origin
              </span>
              <span className="max-w-[210px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-foreground">
                {safeDAppName ? `${safeDAppName} (${safeOrigin})` : safeOrigin}
              </span>
            </div>
          )}

          {safeContractId && (
            <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Contract
              </span>
              <span className="max-w-[210px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-foreground">
                {safeContractId}
              </span>
            </div>
          )}

          {safeMethodName && (
            <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Method
              </span>
              <span className="max-w-[210px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-foreground">
                {safeMethodName}
              </span>
            </div>
          )}

          {safeScopes && safeScopes.length > 0 && (
            <div className="border-t border-border/40 pt-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground block mb-1">
                Requested Scopes
              </span>
              <div className="flex flex-wrap gap-1">
                {safeScopes.map((scope) => (
                  <span
                    key={scope}
                    className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-mono text-cyan-300"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hardwarePreferred && (
            <p className="mt-4 rounded-[14px] bg-accent px-3 py-3 text-[12px] leading-5 text-foreground">
              Ledger signing is enabled. Confirm the transaction on your device after approving.
            </p>
          )}
          {devicePrompt && (
            <p className="mt-3 text-[12px] font-medium text-primary" role="status">
              Waiting for Ledger confirmation…
            </p>
          )}
        </section>

        <div className="mt-auto space-y-3 pt-10">
          <button
            ref={approveRef}
            className="wallet-pill-btn"
            disabled={submitting}
            onClick={() => sendToBackground('approve')}
            type="button"
          >
            {hardwarePreferred ? 'Approve on Ledger' : 'Approve'}
          </button>
          <button
            className="w-full py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            disabled={submitting}
            onClick={() => sendToBackground('reject')}
            type="button"
          >
            Reject
          </button>
        </div>
      </main>
    </div>
  );
}
