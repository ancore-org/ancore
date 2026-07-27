/**
 * Typed response interfaces for the Relayer Service.
 */

import type { RelayErrorCode } from './errorCodes';

export { RelayErrorCodes, RELAY_ERROR_CODES, isRelayErrorCode } from './errorCodes';
export type { RelayErrorCode } from './errorCodes';

export interface RelayError {
  /** Stable machine-readable code — switch on this, never on `message`. */
  code: RelayErrorCode;
  /** Human-readable detail. Free text; not part of the API contract. */
  message: string;
}

/** Response for POST /relay/execute */
export interface RelayExecuteResponse {
  success: boolean;
  transactionId?: string;
  error?: RelayError;
  gasUsed: number;
}

/** Response for POST /relay/validate */
export interface ValidationResult {
  valid: boolean;
  error?: RelayError;
}

export interface DependencyStatus {
  status: 'ok' | 'degraded';
  message?: string;
  latencyMs?: number;
}

/** Response for GET /relay/status */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  dependencies?: {
    queue: DependencyStatus;
    rpc: DependencyStatus;
    storage: DependencyStatus;
    signatureService?: DependencyStatus;
  };
}
