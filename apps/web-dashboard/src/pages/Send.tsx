import React, { useMemo, useState } from 'react';
import { Send, Loader2, CheckCircle2, ExternalLink, Wallet, Shield } from 'lucide-react';
import { useSendTransaction, validateRecipientInput } from '../hooks/useSendTransaction';
import { useSendFeeEstimate } from '../hooks/useSendFeeEstimate';
import { useWalletConnection } from '../hooks/useWalletConnection';
import type { SendStrategy } from '../services/send-service';
import type { Transaction } from '../types/dashboard';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

function StatusBadge({ status }: { status: Transaction['status'] }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    pending: 'bg-blue-100 text-blue-700',
    submitting: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}

function WalletStatus({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
  if (DEMO_MODE) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
        connected
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}
    >
      <Wallet className="w-3.5 h-3.5" />
      {connected ? (
        <span>Extension connected</span>
      ) : (
        <button type="button" onClick={onConnect} className="underline hover:no-underline">
          Connect wallet
        </button>
      )}
    </div>
  );
}

export const SendPage: React.FC = () => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const wallet = useWalletConnection();

  const sendStrategy = useMemo<SendStrategy | null>(() => {
    if (DEMO_MODE) return null;
    // In production: return createSendStrategy('wallet-api', { network: 'testnet' });
    return null;
  }, []);

  const send = useSendTransaction({
    sendStrategy,
    demoMode: DEMO_MODE,
    network: 'testnet',
  });

  const feeEstimate = useSendFeeEstimate(recipient, amount, {
    disabled: DEMO_MODE || !recipient || !amount,
  });

  // Live format feedback while typing. An empty field is not an error yet —
  // that only surfaces on submit, via the hook.
  const liveRecipientError = useMemo(
    () => (recipient.trim() ? (validateRecipientInput(recipient) ?? null) : null),
    [recipient]
  );
  const recipientError = send.recipientError ?? liveRecipientError;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Enter an amount greater than 0');
      return;
    }

    try {
      await send.sendTransaction({ recipient, amount: numericAmount });
    } catch {
      // Hook exposes errors for rendering below.
    }
  };

  const optimistic = send.optimisticTransaction;

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Send</p>
          <h1 className="mt-2 text-3xl font-semibold">Send XLM</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter a Stellar address or an @username handle. Handles are resolved before
            confirmation.
          </p>
        </div>
        <WalletStatus connected={wallet.connected} onConnect={wallet.connect} />
      </div>

      <form className="space-y-5 rounded-xl border bg-card p-6 shadow-sm" onSubmit={onSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Recipient</span>
          <input
            aria-describedby={recipientError ? 'recipient-error' : undefined}
            aria-invalid={!!recipientError}
            className="w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="@alice or G..."
            value={recipient}
          />
        </label>
        {recipientError && (
          <p className="text-sm font-medium text-destructive" id="recipient-error" role="alert">
            {recipientError}
          </p>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium">Amount (XLM)</span>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            value={amount}
          />
        </label>
        {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}

        {send.resolvedRecipient && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-semibold">Resolved recipient</p>
            {send.resolvedRecipient.handle && (
              <p>
                {send.resolvedRecipient.handle.handle}
                {send.resolvedRecipient.handle.displayName
                  ? ` · ${send.resolvedRecipient.handle.displayName}`
                  : ''}
              </p>
            )}
            <p className="break-all font-mono text-xs">{send.resolvedRecipient.accountAddress}</p>
          </div>
        )}

        {/* Fee estimate (real mode only) */}
        {!DEMO_MODE && recipient && amount && (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">Estimated fee</span>
            <span className="font-medium">
              {feeEstimate.loading ? (
                <Loader2 className="w-3 h-3 animate-spin inline" />
              ) : (
                `${feeEstimate.fee} XLM`
              )}
            </span>
          </div>
        )}

        {/* Signing method badge (real mode only) */}
        {!DEMO_MODE && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5" />
            <span>
              {wallet.connected
                ? 'Sign via Ancore extension'
                : 'Session Key Relay (extension not detected)'}
            </span>
          </div>
        )}

        {send.error && !recipientError && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {send.error.message}
          </p>
        )}

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={send.loading || !!liveRecipientError}
          type="submit"
        >
          {send.loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {send.loading ? 'Sending...' : 'Review and send'}
        </button>
      </form>

      {/* Transaction status card */}
      {optimistic && (
        <div className="rounded-xl border bg-card p-4 text-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Transaction</p>
            <StatusBadge status={optimistic.status} />
          </div>
          <p className="break-all font-mono text-xs">To: {optimistic.counterparty}</p>
          <p>Amount: {optimistic.amount} XLM</p>

          {optimistic.hash && (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${optimistic.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline inline-flex items-center gap-1"
            >
              {optimistic.hash.slice(0, 16)}… <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {optimistic.status === 'pending' && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              Waiting for on-chain confirmation…
            </div>
          )}

          {optimistic.status === 'confirmed' && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              Confirmed on-chain
            </div>
          )}

          {optimistic.signMethod && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              Signed via {optimistic.signMethod === 'wallet-api' ? 'Extension' : 'Relay'}
            </div>
          )}

          {optimistic.error && <p className="text-xs text-red-600">{optimistic.error}</p>}
        </div>
      )}
    </section>
  );
};
