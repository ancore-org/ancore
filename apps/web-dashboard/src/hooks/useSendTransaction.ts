import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isUsernameHandle,
  normalizeUsernameHandle,
  type HandleResolver,
  type ResolvedHandle,
} from '@ancore/types';
import type { Transaction, TransactionStatus, SignMethod } from '../types/dashboard';
import { stellarAddressError } from '../lib/address-validation';
import { resolveHandle as defaultResolveHandle } from '../services/handle-resolver';
import type { SendStrategy, SendResult } from '../services/send-service';
import { pollTransactionConfirmation, type TransactionPollStatus } from '../services/tx-polling';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  /** Real send strategy — when omitted or null, falls back to demo mock. */
  sendStrategy?: SendStrategy | null;
  /** Polling interval for confirmation. Default: 5000ms. */
  pollIntervalMs?: number;
  /** Max polling attempts. Default: 60. */
  pollMaxAttempts?: number;
  /** Network for Horizon polling. Default: 'testnet'. */
  network?: 'testnet' | 'mainnet' | 'futurenet' | 'local';
  /**
   * Force demo mode (mock send). When true, ignores sendStrategy
   * and uses setTimeout simulation. Default: false.
   */
  demoMode?: boolean;
  /** Legacy: delay before "submitting". Only used in demo mode. */
  submitDelayMs?: number;
  /** Legacy: delay before "confirmed". Only used in demo mode. */
  confirmationDelayMs?: number;
}

interface SendTransactionState {
  loading: boolean;
  error: Error | null;
  recipientError: string | null;
  resolvedRecipient: ResolvedSendRecipient | null;
}

interface PollController {
  stop: () => void;
  result: Promise<TransactionPollStatus>;
}

const HANDLE_NOT_FOUND_MESSAGE = 'Handle not found';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate what the user typed into the recipient field.
 *
 * Handles (`@alice`) are checked for shape only — resolution happens later.
 * Everything else must be a Stellar address; the check is shared with the
 * other dashboard forms so the wording and accepted formats stay identical.
 */
export function validateRecipientInput(recipient: string): string | undefined {
  const trimmed = recipient.trim();

  if (!trimmed) {
    return 'Recipient address or @username is required';
  }

  if (trimmed.startsWith('@')) {
    return isUsernameHandle(trimmed) ? undefined : 'Enter a valid @username handle';
  }

  return stellarAddressError(trimmed) ?? undefined;
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

// ---------------------------------------------------------------------------
// Demo mode (mock)
// ---------------------------------------------------------------------------

async function demoSend(
  _params: SendTransactionParams,
  submitDelayMs: number,
  confirmationDelayMs: number
): Promise<SendResult> {
  await new Promise((resolve) => setTimeout(resolve, submitDelayMs));
  await new Promise((resolve) => setTimeout(resolve, confirmationDelayMs));
  return {
    status: 'submitted',
    hash: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to handle sending transactions with optimistic updates.
 * Supports real blockchain submission via SendStrategy or demo mode fallback.
 */
export const useSendTransaction = (options: UseSendTransactionOptions = {}) => {
  const {
    sendStrategy = null,
    demoMode = false,
    pollIntervalMs = 5000,
    pollMaxAttempts = 60,
    network = 'testnet',
    submitDelayMs = 1000,
    confirmationDelayMs = 2000,
  } = options;

  const [state, setState] = useState<SendTransactionState>({
    loading: false,
    error: null,
    recipientError: null,
    resolvedRecipient: null,
  });

  const [optimisticTransaction, setOptimisticTransaction] = useState<Transaction | null>(null);
  const pollRef = useRef<PollController | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      pollRef.current?.stop();
    };
  }, []);

  /**
   * Sends a transaction and optimistically adds it to the transaction list.
   */
  const sendTransaction = useCallback(
    async (params: SendTransactionParams) => {
      // Abort any existing poll
      pollRef.current?.stop();
      pollRef.current = null;

      setState({ loading: true, error: null, recipientError: null, resolvedRecipient: null });

      try {
        const resolvedRecipient = await resolveSendRecipient(
          params.recipient,
          options.resolveHandle ?? defaultResolveHandle
        );

        const useDemo = demoMode || !sendStrategy;
        const signMethod: SignMethod = useDemo
          ? 'wallet-api'
          : sendStrategy!.name === 'wallet-api'
            ? 'wallet-api'
            : 'relayer';

        // Create optimistic transaction
        const optimisticTx: Transaction = {
          id: `optimistic-${Date.now()}-${Math.random()}`,
          type: 'send',
          amount: params.amount,
          timestamp: new Date(),
          status: 'submitting',
          counterparty: resolvedRecipient.accountAddress,
          signMethod,
        };

        setOptimisticTransaction(optimisticTx);
        setState({ loading: true, error: null, recipientError: null, resolvedRecipient });

        let sendResult: SendResult;

        if (useDemo) {
          sendResult = await demoSend(params, submitDelayMs, confirmationDelayMs);
        } else {
          sendResult = await sendStrategy!.send({
            recipient: resolvedRecipient.accountAddress,
            amount: String(params.amount),
          });
        }

        if (useDemo) {
          // Demo mode: go straight to confirmed
          setOptimisticTransaction({
            ...optimisticTx,
            status: 'confirmed',
            id: `confirmed-${Date.now()}`,
            hash: sendResult.hash,
          });
          setState({ loading: false, error: null, recipientError: null, resolvedRecipient });
        } else {
          // Real mode: set to pending (submitted but awaiting on-chain confirmation)
          setOptimisticTransaction({
            ...optimisticTx,
            status: 'pending',
            hash: sendResult.hash,
          });
          setState({ loading: false, error: null, recipientError: null, resolvedRecipient });

          const controller = startPolling(sendResult.hash, {
            intervalMs: pollIntervalMs,
            maxAttempts: pollMaxAttempts,
            network,
            isRelayerJob: sendResult.status === 'pending',
          });
          pollRef.current = controller;

          // Wait for confirmation asynchronously (don't block UI)
          void controller.result.then((pollStatus) => {
            if (!isMountedRef.current) return;
            setOptimisticTransaction((prev) => {
              if (!prev || prev.hash !== sendResult.hash) return prev;
              return {
                ...prev,
                status: mapPollStatus(pollStatus.status),
                id: `${pollStatus.status}-${Date.now()}`,
                error:
                  pollStatus.status === 'failed'
                    ? (pollStatus.error ?? 'Transaction failed')
                    : undefined,
              };
            });
            pollRef.current = null;
          });
        }

        return optimisticTx;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to send transaction');

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
    [
      demoMode,
      options.resolveHandle,
      pollIntervalMs,
      pollMaxAttempts,
      sendStrategy,
      submitDelayMs,
      confirmationDelayMs,
      network,
    ]
  );

  const clearOptimistic = useCallback(() => {
    pollRef.current?.stop();
    pollRef.current = null;
    setOptimisticTransaction(null);
  }, []);

  const rollback = useCallback(() => {
    pollRef.current?.stop();
    pollRef.current = null;
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function startPolling(
  hash: string,
  options: {
    intervalMs: number;
    maxAttempts: number;
    network: string;
    isRelayerJob: boolean;
  }
): PollController {
  let stopped = false;
  let resolveResult!: (value: TransactionPollStatus) => void;

  const result = new Promise<TransactionPollStatus>((resolve) => {
    resolveResult = resolve;
  });

  void (async () => {
    for (let attempt = 0; attempt < options.maxAttempts && !stopped; attempt++) {
      try {
        const pollResult = await pollTransactionConfirmation(hash, {
          intervalMs: options.intervalMs,
          maxAttempts: 1,
          network: options.network as 'testnet' | 'mainnet' | 'futurenet' | 'local',
          isRelayerJob: options.isRelayerJob,
        });

        if (pollResult.status.status === 'confirmed' || pollResult.status.status === 'failed') {
          resolveResult(pollResult.status);
          return;
        }
      } catch {
        // Continue polling on error
      }

      if (attempt < options.maxAttempts - 1 && !stopped) {
        await new Promise((r) => setTimeout(r, options.intervalMs));
      }
    }

    resolveResult({ status: 'failed', error: 'Polling timed out' });
  })();

  return {
    stop: () => {
      stopped = true;
    },
    result,
  };
}

function mapPollStatus(status: TransactionPollStatus['status']): TransactionStatus {
  switch (status) {
    case 'confirmed':
      return 'confirmed';
    case 'failed':
      return 'failed';
    case 'pending':
      return 'pending';
  }
}
