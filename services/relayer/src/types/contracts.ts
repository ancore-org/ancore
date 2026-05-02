/**
 * Service interface contracts for the Relayer Service.
 *
 * These interfaces define the boundaries between layers and enable
 * dependency injection / test doubles.
 */

import type { RelayExecuteRequest } from './requests';
import type { RelayExecuteResponse, ValidationResult, HealthResponse } from './responses';

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
