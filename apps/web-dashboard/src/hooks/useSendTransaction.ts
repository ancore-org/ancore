import { useState, useCallback } from 'react';
import type { Transaction } from '../types/dashboard';

export interface SendTransactionParams {
  recipient: string;
  amount: number;
}

interface SendTransactionState {
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to handle sending transactions with optimistic updates.
 * Immediately shows a pending transaction while the blockchain confirms.
 */
export const useSendTransaction = () => {
  const [state, setState] = useState<SendTransactionState>({
    loading: false,
    error: null,
  });

  const [optimisticTransaction, setOptimisticTransaction] = useState<Transaction | null>(null);

  /**
   * Sends a transaction and optimistically adds it to the transaction list.
   * The transaction starts in 'pending' status until blockchain confirmation.
   */
  const sendTransaction = useCallback(async (params: SendTransactionParams) => {
    setState({ loading: true, error: null });

    try {
      // Create optimistic transaction immediately
      const optimisticTx: Transaction = {
        id: `optimistic-${Date.now()}-${Math.random()}`,
        type: 'send',
        amount: params.amount,
        timestamp: new Date(),
        status: 'pending',
        counterparty: params.recipient,
      };

      setOptimisticTransaction(optimisticTx);

      // Simulate blockchain submission (in production, call real API)
      // This would call sendPayment from @ancore/core-sdk
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // In a real implementation, would wait for blockchain confirmation
      // For now, mark as confirmed after delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update optimistic transaction to confirmed
      setOptimisticTransaction({
        ...optimisticTx,
        status: 'confirmed',
        id: `confirmed-${Date.now()}`,
      });

      setState({ loading: false, error: null });
      return optimisticTx;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send transaction');

      // Keep optimistic transaction visible but mark failure scenario
      setOptimisticTransaction(null);

      setState({ loading: false, error });
      throw error;
    }
  }, []);

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
    setState({ loading: false, error: null });
  }, []);

  return {
    sendTransaction,
    optimisticTransaction,
    clearOptimistic,
    rollback,
    loading: state.loading,
    error: state.error,
  };
};
