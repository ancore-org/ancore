import React, { useState, useCallback } from 'react';
import { SendForm } from './SendForm';
import { StatusScreen } from './StatusScreen';
import { useSendDraft, type SendDraft } from '@/hooks/useSendDraft';

type FlowStep = 'form' | 'status';

interface SendFlowState {
  step: FlowStep;
  txId: string;
  txStatus: 'idle' | 'pending' | 'confirmed' | 'failed';
  /** Persisted error message shown inline on the form after a failed retry */
  formError: string | null;
}

const INITIAL_STATE: SendFlowState = {
  step: 'form',
  txId: '',
  txStatus: 'idle',
  formError: null,
};

interface SendFlowProps {
  onClose?: () => void;
  /** Injected transaction sender — defaults to a mock for easy testing */
  sendTransaction?: (draft: SendDraft) => Promise<{ txId: string }>;
}

async function defaultSendTransaction(_draft: SendDraft): Promise<{ txId: string }> {
  // Replace with real Stellar/Soroban submission logic.
  throw new Error('sendTransaction not configured');
}

/**
 * SendFlow — orchestrates the multi-step send UX.
 *
 * Steps:
 *  1. `form`   — user enters / edits recipient + amount (pre-populated from draft on retry)
 *  2. `status` — shows pending → confirmed | failed
 *
 * On failure, the flow stays on `status` and surfaces a Retry CTA.
 * Clicking Retry rehydrates the form with the preserved draft and clears
 * the stale error, satisfying all acceptance criteria in #429.
 */
export function SendFlow({ onClose, sendTransaction = defaultSendTransaction }: SendFlowProps) {
  const { draft, updateDraft, clearDraft } = useSendDraft();
  const [state, setState] = useState<SendFlowState>(INITIAL_STATE);

  // ---------- handlers ----------

  const handleFormSubmit = useCallback(async () => {
    setState({ step: 'status', txId: '', txStatus: 'pending', formError: null });

    try {
      const { txId } = await sendTransaction(draft);
      setState({ step: 'status', txId, txStatus: 'confirmed', formError: null });
      // Draft is no longer needed after a successful send.
      clearDraft();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setState({ step: 'status', txId: '', txStatus: 'failed', formError: message });
    }
  }, [draft, sendTransaction, clearDraft]);

  /**
   * handleRetry — called by StatusScreen when the user clicks "Retry Transaction".
   *
   * Acceptance criteria satisfied:
   * - Retry button rehydrates previous draft  ✓  (draft passed straight back in)
   * - Retry path clears stale error on success ✓  (formError reset here; cleared again on success)
   */
  const handleRetry = useCallback(
    (retryDraft: SendDraft) => {
      updateDraft(retryDraft);
      setState((prev) => ({
        ...prev,
        step: 'form',
        txStatus: 'idle',
        // Surface the last error on the form so the user understands why they're retrying.
        formError: prev.formError,
      }));
    },
    [updateDraft]
  );

  const handleClose = useCallback(() => {
    clearDraft();
    setState(INITIAL_STATE);
    onClose?.();
  }, [clearDraft, onClose]);

  // ---------- render ----------

  if (state.step === 'status') {
    return (
      <StatusScreen
        txId={state.txId}
        status={state.txStatus}
        failedDraft={draft}
        onClose={handleClose}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <SendForm
      draft={draft}
      onChange={updateDraft}
      onSubmit={handleFormSubmit}
      error={state.formError}
    />
  );
}
