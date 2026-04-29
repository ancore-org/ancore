/**
 * Transaction Status Mapping
 *
 * Maps RPC / SDK status strings to the app-level TransactionStatusKind
 * used by UI components (TransactionStatus badge, TransactionDetail, etc.).
 *
 * Centralising this mapping means RPC contract changes only need to be
 * updated here, not scattered across components and hooks.
 */

import type { TransactionStatusKind } from '@/components/TransactionStatus';

/**
 * Status values returned by the Stellar RPC / Horizon API.
 * Mirrors TransactionResult.status from packages/types/src/user-operation.ts
 * plus the additional states Horizon can return.
 */
export type RpcTransactionStatus =
  | 'success'
  | 'failure'
  | 'pending'
  | 'not_found'
  | 'error'
  | 'timeout';

/**
 * Status values produced by the send-transaction polling loop
 * (TxStatus from useSendTransaction).
 */
export type PollingTxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

/**
 * Union of every raw status string that can arrive from any RPC source.
 */
export type AnyRpcStatus = RpcTransactionStatus | PollingTxStatus;

/** Exhaustive map from every known RPC status → app status. */
const RPC_TO_APP: Record<AnyRpcStatus, TransactionStatusKind> = {
  // Soroban / Horizon RPC statuses
  success: 'confirmed',
  failure: 'failed',
  pending: 'pending',
  not_found: 'pending', // still propagating through the network
  error: 'failed',
  timeout: 'failed',

  // Polling loop statuses (useSendTransaction)
  idle: 'pending',
  confirmed: 'confirmed',
  failed: 'failed',
};

/**
 * Map an RPC / polling status string to the app-level TransactionStatusKind.
 *
 * Unknown strings fall back to `'pending'` so the UI never crashes on
 * unexpected values from a future API version.
 *
 * @example
 * mapRpcStatus('success')   // → 'confirmed'
 * mapRpcStatus('failure')   // → 'failed'
 * mapRpcStatus('not_found') // → 'pending'
 * mapRpcStatus('UNKNOWN')   // → 'pending'  (safe fallback)
 */
export function mapRpcStatus(raw: string): TransactionStatusKind {
  const normalised = raw.toLowerCase() as AnyRpcStatus;
  return RPC_TO_APP[normalised] ?? 'pending';
}

/**
 * Type-guard: returns true when `raw` is a known RPC status string.
 */
export function isKnownRpcStatus(raw: string): raw is AnyRpcStatus {
  return raw.toLowerCase() in RPC_TO_APP;
}

/**
 * Returns true when the given app status represents a terminal state
 * (i.e. polling should stop).
 */
export function isTerminalStatus(status: TransactionStatusKind): boolean {
  return status === 'confirmed' || status === 'failed' || status === 'cancelled';
}
