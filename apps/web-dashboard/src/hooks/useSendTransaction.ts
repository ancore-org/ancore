import { useState, useCallback } from 'react';
import {
  isUsernameHandle,
  normalizeUsernameHandle,
  type HandleResolver,
  type ResolvedHandle,
} from '@ancore/types';
import type { Transaction } from '../types/dashboard';
import { resolveHandle as defaultResolveHandle } from '../services/handle-resolver';

export interface SendTransactionParams {
  recipient: string;
  amount: number;
}

export interface ResolvedSendRecipient {
  input: string;
  accountAddress: string;
  handle?: ResolvedHandle;
}

export interface UseSendTransactionOptions {
  resolveHandle?: HandleResolver;
  submitDelayMs?: number;
  confirmationDelayMs?: number;
}

interface SendTransactionState {
  loading: boolean;
  error: Error | null;
  recipientError: string | null;
  resolvedRecipient: ResolvedSendRecipient | null;
}

const HANDLE_NOT_FOUND_MESSAGE = 'Handle not found';

function validateRecipientInput(recipient: string): string | undefined {
  const trimmed = recipient.trim();

  if (!trimmed) {
    return 'Recipient address or @username is required';
  }

  if (trimmed.startsWith('@')) {
    return isUsernameHandle(trimmed) ? undefined : 'Enter a valid @username handle';
  }

  return /^G[A-Z0-9]{55}$/.test(trimmed) ? undefined : 'Invalid Stellar address';
}

export async function resolveSendRecipient(
  recipient: string,
  resolver: HandleResolver = defaultResolveHandle
): Promise<ResolvedSendRecipient> {
  const trimmed = recipient.trim();
  const validationError = validateRecipientInput(trimmed);

  if (validationError) {
    throw new Error(validationError);
  }

  if (!trimmed.startsWith('@')) {
    return { input: trimmed, accountAddress: trimmed };
  }

  const handle = normalizeUsernameHandle(trimmed);
  const resolved = await resolver(handle);

  if (!resolved) {
    throw new Error(HANDLE_NOT_FOUND_MESSAGE);
  }

  return { input: trimmed, accountAddress: resolved.accountAddress, handle: resolved };
}

/**
 * Hook to handle sending transactions with optimistic updates.
 * Immediately shows a pending transaction while the blockchain confirms.
 */
export const useSendTransaction = (options: UseSendTransactionOptions = {}) => {
  const [state, setState] = useState<SendTransactionState>({
    loading: false,
    error: null,
    recipientError: null,
    resolvedRecipient: null,
  });

  const [optimisticTransaction, setOptimisticTransaction] = useState<Transaction | null>(null);

  /**
   * Sends a transaction and optimistically adds it to the transaction list.
   * The transaction starts in 'pending' status until blockchain confirmation.
   */
  const sendTransaction = useCallback(
    async (params: SendTransactionParams) => {
      setState({ loading: true, error: null, recipientError: null, resolvedRecipient: null });

      try {
        const resolvedRecipient = await resolveSendRecipient(
          params.recipient,
          options.resolveHandle ?? defaultResolveHandle
        );

        // Create optimistic transaction immediately
        const optimisticTx: Transaction = {
          id: `optimistic-${Date.now()}-${Math.random()}`,
          type: 'send',
          amount: params.amount,
          timestamp: new Date(),
          status: 'pending',
          counterparty: resolvedRecipient.accountAddress,
        };

        setOptimisticTransaction(optimisticTx);

        setState({ loading: true, error: null, recipientError: null, resolvedRecipient });

        // Simulate blockchain submission (in production, call real API)
        // This would call sendPayment from @ancore/core-sdk
        await new Promise((resolve) => setTimeout(resolve, options.submitDelayMs ?? 1000));

        // In a real implementation, would wait for blockchain confirmation
        // For now, mark as confirmed after delay
        await new Promise((resolve) => setTimeout(resolve, options.confirmationDelayMs ?? 2000));

        // Update optimistic transaction to confirmed
        setOptimisticTransaction({
          ...optimisticTx,
          status: 'confirmed',
          id: `confirmed-${Date.now()}`,
        });

        setState({ loading: false, error: null, recipientError: null, resolvedRecipient });
        return optimisticTx;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to send transaction');

        // Keep optimistic transaction visible but mark failure scenario
        setOptimisticTransaction(null);

        const recipientError =
          error.message === HANDLE_NOT_FOUND_MESSAGE ||
          error.message.includes('Recipient') ||
          error.message.includes('address') ||
          error.message.includes('@username')
            ? error.message
            : null;

        setState({ loading: false, error, recipientError, resolvedRecipient: null });
        throw error;
      }
    },
    [options.confirmationDelayMs, options.resolveHandle, options.submitDelayMs]
  );

  /**
   * Clears the optimistic transaction (e.g., on navigation or manual clearing).
   */
  const clearOptimistic = useCallback(() => {
    setOptimisticTransaction(null);
  }, []);

  /**
   * Rolls back the optimistic update in case of failure.
   */
  const rollback = useCallback(() => {
    setOptimisticTransaction(null);
    setState({ loading: false, error: null, recipientError: null, resolvedRecipient: null });
  }, []);

  return {
    sendTransaction,
    optimisticTransaction,
    clearOptimistic,
    rollback,
    loading: state.loading,
    error: state.error,
    recipientError: state.recipientError,
    resolvedRecipient: state.resolvedRecipient,
  };
};
