import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useSendTransaction } from '../hooks/useSendTransaction';

export const SendPage: React.FC = () => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const send = useSendTransaction({ submitDelayMs: 0, confirmationDelayMs: 0 });

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
      // Hook exposes field-specific and global errors for rendering below.
    }
  };

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Send</p>
        <h1 className="mt-2 text-3xl font-semibold">Send XLM</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a Stellar address or an @username handle. Handles are resolved before confirmation.
        </p>
      </div>

      <form className="space-y-5 rounded-xl border bg-card p-6 shadow-sm" onSubmit={onSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Recipient</span>
          <input
            aria-describedby={send.recipientError ? 'recipient-error' : undefined}
            aria-invalid={!!send.recipientError}
            className="w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="@alice or G..."
            value={recipient}
          />
        </label>
        {send.recipientError && (
          <p className="text-sm font-medium text-destructive" id="recipient-error" role="alert">
            {send.recipientError}
          </p>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium">Amount</span>
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

        {send.error && !send.recipientError && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {send.error.message}
          </p>
        )}

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={send.loading}
          type="submit"
        >
          <Send className="h-4 w-4" />
          {send.loading ? 'Resolving...' : 'Review and send'}
        </button>
      </form>

      {send.optimisticTransaction && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-semibold">Transaction {send.optimisticTransaction.status}</p>
          <p className="break-all font-mono text-xs">
            To: {send.optimisticTransaction.counterparty}
          </p>
          <p>Amount: {send.optimisticTransaction.amount} XLM</p>
        </div>
      )}
    </section>
  );
};
