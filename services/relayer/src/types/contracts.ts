/**
 * Service interface contracts for the Relayer Service.
 *
 * These interfaces define the boundaries between layers and enable
 * dependency injection / test doubles.
 */

import type { RelayExecuteRequest } from './requests';
import type { RelayExecuteResponse, ValidationResult, HealthResponse } from './responses';

/** Result of submitting a signed transaction to Stellar/Soroban */
export interface TransactionSubmissionResult {
  transactionHash: string;
  gasUsed: number;
}

/** Boundary for Horizon/Soroban transaction submission (mockable in tests) */
export interface TransactionSubmitterContract {
  submitSignedTransaction(signedXdr: string): Promise<TransactionSubmissionResult>;
  isHealthy(): Promise<{ healthy: boolean; latencyMs?: number }>;
}

export interface RelayServiceOptions {
  /** Dev-only: skip network submission and return a synthetic transaction id */
  useMockSubmission?: boolean;
}

/** Core relay service contract */
export interface RelayServiceContract {
  executeRelay(request: RelayExecuteRequest): Promise<RelayExecuteResponse>;
  validateRelay(request: RelayExecuteRequest): Promise<ValidationResult>;
  health(): HealthResponse;
}

/** Authentication / authorisation contract */
export interface AuthServiceContract {
  /**
   * Verify the bearer token from the Authorization header.
   * Returns the caller identity on success, throws on failure.
   */
  verifyToken(token: string): Promise<{ callerId: string }>;
}

/** Signature verification contract */
export interface SignatureServiceContract {
  /**
   * Verify an Ed25519 signature over `payload` using `publicKey`.
   * Both values are hex-encoded strings.
   */
  verify(publicKey: string, payload: string, signature: string): boolean;
}
