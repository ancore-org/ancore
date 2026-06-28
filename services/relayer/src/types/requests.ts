/**
 * Typed request interfaces for the Relayer Service.
 *
 * These extend the Zod-inferred types from src/api/types.ts with additional
 * operation-level abstractions used by handlers and the service layer.
 */

import type { TransferPolicy } from '@ancore/types';

export type OperationType = 'relay_execute' | 'add_session_key' | 'revoke_session_key';

/**
 * Generic relay execution request.
 * Maps to POST /relay/execute.
 */
export interface RelayExecuteRequest {
  /** Hex-encoded Ed25519 session public key (64 chars) */
  sessionKey: string;
  operation: OperationType;
  parameters: Record<string, unknown>;
  /** Hex-encoded Ed25519 signature over canonical payload (128 chars) */
  signature: string;
  /** Replay-protection nonce (non-negative integer) */
  nonce: number;
  /** Optional transfer policy for enforcing daily limits */
  transferPolicy?: {
    policy: TransferPolicy;
    amount: number;
    todayTotal: number;
  };
}

/**
 * Request to validate a relay payload without executing it.
 * Maps to POST /relay/validate.
 */
export type RelayValidateRequest = RelayExecuteRequest;
