/**
 * Typed response interfaces for the Relayer Service.
 */

export type RelayErrorCode =
  | 'INVALID_SIGNATURE'
  | 'SESSION_KEY_EXPIRED'
  | 'NONCE_REPLAY'
  | 'GAS_LIMIT_EXCEEDED'
  | 'SIMULATION_FAILED'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR';

export interface RelayError {
  code: RelayErrorCode;
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

/** Response for GET /relay/status */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
}
