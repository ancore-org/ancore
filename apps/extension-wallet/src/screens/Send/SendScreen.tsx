import React, { useState, useEffect, useMemo } from 'react';
import { isMemoRequired } from '@/utils/memoCheck';
import { AddressInput, cn } from '@ancore/ui-kit';
import { BASE_SEND_RESERVE, DEFAULT_SEND_FEE } from '@/utils/amount';
import {
  useSendTransaction,
  type SendFormValues,
  type SendService,
} from '@/hooks/useSendTransaction';
import { useRecentRecipients } from '@/hooks/useRecentRecipients';
import { useAccountStore } from '@/stores/account';
import { useExtensionAuth } from '@/router/AuthGuard';
import { ConfirmDialog } from '@/screens/Send/ConfirmDialog';
import { ReviewScreen } from '@/screens/Send/ReviewScreen';
import { StatusScreen } from '@/screens/Send/StatusScreen';
import { AiDraftPanel } from '@/screens/Send/AiDraftPanel';
import type { AgentDraftIntent } from '@/services/ai-agent-client';
import { TransferNoteInput } from '@/components/TransferNoteInput';
import { AlertCircle, ArrowLeftRight, Delete, Sparkles, X } from 'lucide-react';
import {
  ScheduleControls,
  createDefaultScheduleConfig,
  type ScheduleConfig,
  type TransferTiming,
} from '@/screens/Send/ScheduleControls';
import { ScheduledConfirmationScreen } from '@/screens/ScheduledTransfers/ScheduledConfirmationScreen';

interface SendScreenProps {
  balance?: number;
  /** Maximum decimal places for the asset being sent. Defaults to 7 (XLM). */
  assetDecimals?: number;
  service?: SendService;
  pollIntervalMs?: number;
}

const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

/**
 * SendScreen — amount-first send form (ref: swap amount entry).
 * Dark sheet, large amount, soft Continue pill, optional numpad for amount.
 */
export function SendScreen({
  balance,
  assetDecimals = 7,
  service,
  pollIntervalMs,
}: SendScreenProps) {
  const [form, setForm] = useState<SendFormValues>({
    to: '',
    amount: '',
    note: '',
    timing: 'immediate',
    schedule: createDefaultScheduleConfig(),
  });

  const send = useSendTransaction({ balance, assetDecimals, service, pollIntervalMs });
  const { recipients, addRecipient } = useRecentRecipients();
  const [memoWarning, setMemoWarning] = useState<string | null>(null);
  const [showAiDraft, setShowAiDraft] = useState(false);

  const { authState } = useExtensionAuth();
  const activeAccountId = useAccountStore((state) => state.activeAccountId);
  const accounts = useAccountStore((state) => state.accounts);
  const accountAddress = useMemo(
    () => accounts.find((a) => a.id === activeAccountId)?.address ?? authState.accountAddress,
    [accounts, activeAccountId, authState.accountAddress]
  );

  /**
   * Accepts an AI-drafted intent and prefills the form for the user to
   * review. GUARDRAIL: this only sets local form state — it does not touch
   * `send.tx`, does not call `send.goToReview`, and does not submit
   * anything. The user still has to go through Continue → Review → Confirm
   * → Sign like any other send.
   */
  const handleAiDraftAccept = (intent: AgentDraftIntent) => {
    if (intent.type === 'payment') {
      setForm((current) => ({ ...current, to: intent.destination, amount: intent.amount }));
    }
    setShowAiDraft(false);
  };

  const isMainnet = send.tx?.fee?.network === 'mainnet' || !send.tx;

  useEffect(() => {
    setMemoWarning(null);
    if (!form.to || !isMainnet) return;
    isMemoRequired(form.to).then((required) => {
      if (required && !form.note) {
        setMemoWarning(
          'This exchange requires a memo. Without it, your payment may not be credited to your account.'
        );
      }
    });
  }, [form.to, form.note, isMainnet]);

  const balanceDisplay = balance !== undefined ? balance.toFixed(7).replace(/\.?0+$/, '') : '—';
  const maxDisabled = balance === undefined || balance <= BASE_SEND_RESERVE + DEFAULT_SEND_FEE;

  const onMax = async () => {
    const maxAmount = await send.setMaxAmount({ to: form.to, asset: 'XLM' });
    setForm((current) => ({ ...current, amount: maxAmount }));
  };

  const handleReview = async () => {
    if (memoWarning) return;
    const success = await send.goToReview(form);
    if (success) {
      await addRecipient({ address: send.tx?.to ?? form.to });
    }
  };

  const appendAmount = (key: (typeof NUMPAD)[number]) => {
    setForm((current) => {
      let next = current.amount || '';
      if (key === 'back') {
        next = next.slice(0, -1);
      } else if (key === '.') {
        if (next.includes('.')) return current;
        next = next === '' ? '0.' : `${next}.`;
      } else {
        if (next === '0') next = key;
        else next = `${next}${key}`;
        const [, dec = ''] = next.split('.');
        if (dec.length > assetDecimals) return current;
      }
      return { ...current, amount: next };
    });
  };

  const amountLabel = form.amount || '0';
  const approxUsd =
    form.amount && !Number.isNaN(Number(form.amount))
      ? `≈ ${(Number(form.amount) * 0.12).toFixed(2)} USD` // placeholder rate until price feed
      : '';

  if (send.step === 'review' && send.tx) {
    return (
      <ReviewScreen
        transaction={send.tx}
        timing={send.timing}
        schedule={send.schedule}
        simulation={send.simulation}
        onBack={() => send.setStep('form')}
        onConfirm={send.requestConfirm}
      />
    );
  }

  if (send.step === 'confirm' && send.tx) {
    return (
      <ConfirmDialog
        transaction={send.tx}
        timing={send.timing}
        error={send.errors.password}
        loading={send.submitting}
        onBack={() => send.setStep('review')}
        onSign={send.confirmAndSubmit}
      />
    );
  }

  if (send.step === 'scheduled' && send.scheduledTransfer) {
    return <ScheduledConfirmationScreen transfer={send.scheduledTransfer} />;
  }

  if (send.step === 'status' && send.txId) {
    return <StatusScreen txId={send.txId} status={send.status} />;
  }

  return (
    <div className="wallet-sheet">
      <header className="wallet-header flex items-center justify-between">
        <h1 className="wallet-title">Send</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowAiDraft((current) => !current)}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            {showAiDraft ? 'Manual' : 'AI draft'}
          </button>
          <button
            type="button"
            className="wallet-icon-btn"
            aria-label="Close send"
            onClick={() => window.history.back()}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6">
        {showAiDraft && (
          <AiDraftPanel
            accountId={accountAddress}
            onAccept={handleAiDraftAccept}
            onClose={() => setShowAiDraft(false)}
          />
        )}

        {/* Source asset card */}
        <div className="wallet-card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                X
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-foreground">Stellar</p>
                <p className="truncate text-[13px] text-muted-foreground">{balanceDisplay} XLM</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onMax()}
              disabled={maxDisabled}
              className="shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-white/15 disabled:opacity-40"
            >
              Use Max
            </button>
          </div>

          <div className="text-center">
            <p className="wallet-amount-display text-foreground">
              {amountLabel}
              <span className="ml-1 text-[28px] font-medium text-muted-foreground">XLM</span>
            </p>
            {approxUsd && (
              <p className="mt-2 flex items-center justify-center gap-1 text-[13px] text-muted-foreground">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[10px] text-primary">
                  $
                </span>
                {approxUsd}
                <ArrowLeftRight className="h-3 w-3 opacity-50" aria-hidden />
              </p>
            )}
            {send.errors.amount && (
              <p className="mt-2 text-[13px] text-red-400">{send.errors.amount}</p>
            )}
          </div>
        </div>

        {/* Recipient */}
        <div className="wallet-card space-y-3">
          <AddressInput
            label="To"
            placeholder="@username or G…"
            value={form.to}
            error={send.errors.to}
            recentRecipients={recipients}
            onSelectRecent={(address) => setForm((current) => ({ ...current, to: address }))}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((current) => ({ ...current, to: event.target.value }))
            }
          />
          <TransferNoteInput
            value={form.note || ''}
            onChange={(note) => setForm((current) => ({ ...current, note }))}
            error={send.errors.note}
            placeholder="Memo (optional)"
          />
        </div>

        <ScheduleControls
          timing={(form.timing ?? 'immediate') as TransferTiming}
          schedule={(form.schedule ?? createDefaultScheduleConfig()) as ScheduleConfig}
          error={send.errors.simulation}
          onTimingChange={(timing) =>
            setForm((current) => ({
              ...current,
              timing,
              schedule: current.schedule ?? createDefaultScheduleConfig(),
            }))
          }
          onScheduleChange={(schedule) =>
            setForm((current) => ({
              ...current,
              timing: 'scheduled',
              schedule,
            }))
          }
        />

        {memoWarning && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-[13px] text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="leading-relaxed">{memoWarning}</p>
          </div>
        )}

        {send.errors.simulation && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[13px] text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="leading-relaxed">{send.errors.simulation}</p>
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-1 px-1 pt-2">
          {NUMPAD.map((key) => (
            <button
              key={key}
              type="button"
              className="wallet-numpad-key"
              aria-label={key === 'back' ? 'Delete' : key}
              onClick={() => appendAmount(key)}
            >
              {key === 'back' ? <Delete className="h-6 w-6" strokeWidth={1.75} /> : key}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={cn('wallet-pill-btn mt-2')}
          disabled={Boolean(memoWarning) || send.submitting}
          onClick={() => void handleReview()}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
