/**
 * @ancore/core-sdk - Custom Error Types
 *
 * Descriptive error classes for account abstraction operations.
 * Each error carries an actionable message so developers know exactly
 * what went wrong and what to do about it.
 */

// ---------------------------------------------------------------------------
// Base error
// ---------------------------------------------------------------------------

/**
 * Base class for all Ancore SDK errors.
 * Preserves the original stack trace and carries a machine-readable `code`.
 */
export class AncoreSdkError extends Error {
  /** Machine-readable error code for programmatic handling. */
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AncoreSdkError';
    this.code = code;
    // Maintain proper prototype chain for `instanceof`
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Error response type guards
// ---------------------------------------------------------------------------

/** An error-like value with a machine-readable code supplied by an API or SDK. */
export interface ErrorWithCode<Code extends string = string> {
  code?: Code;
  message?: string;
  statusCode?: number;
  status?: number;
}

type ErrorCodeValue = ErrorWithCode | { statusCode?: unknown; status?: unknown };

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code.toUpperCase().replace(/[\s-]/g, '_') : undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { status, statusCode } = error as ErrorCodeValue;
  return typeof statusCode === 'number'
    ? statusCode
    : typeof status === 'number'
      ? status
      : undefined;
}

function hasErrorCode<Code extends string>(
  error: unknown,
  codes: readonly Code[],
  status?: number
): error is ErrorWithCode<Code> {
  const code = getErrorCode(error);
  return (
    (code !== undefined && (codes as readonly string[]).includes(code)) ||
    (status !== undefined && getErrorStatus(error) === status)
  );
}

/** True for a 429 response or a rate-limit error code, including wallet unlock limits. */
export function isRateLimitError(
  error: unknown
): error is ErrorWithCode<'RATE_LIMITED' | 'RATE_LIMIT' | 'UNLOCK_RATE_LIMITED'> {
  return hasErrorCode(error, ['RATE_LIMITED', 'RATE_LIMIT', 'UNLOCK_RATE_LIMITED'] as const, 429);
}

/** True when a transaction cannot be funded by the account's available balance. */
export function isInsufficientBalance(
  error: unknown
): error is ErrorWithCode<
  'INSUFFICIENT_BALANCE' | 'TX_INSUFFICIENT_BALANCE' | 'OP_UNDERFUNDED' | 'TX_INSUFFICIENT_FEE'
> {
  return hasErrorCode(error, [
    'INSUFFICIENT_BALANCE',
    'TX_INSUFFICIENT_BALANCE',
    'OP_UNDERFUNDED',
    'TX_INSUFFICIENT_FEE',
  ] as const);
}

/** True when a signing request or submitted transaction has an invalid signature. */
export function isInvalidSignatureError(
  error: unknown
): error is ErrorWithCode<
  'INVALID_SIGNATURE' | 'SIGNATURE_INVALID' | 'TX_BAD_AUTH' | 'OP_BAD_AUTH'
> {
  return hasErrorCode(error, [
    'INVALID_SIGNATURE',
    'SIGNATURE_INVALID',
    'TX_BAD_AUTH',
    'OP_BAD_AUTH',
  ] as const);
}

/** True when a request exceeded its network timeout. */
export function isNetworkTimeoutError(
  error: unknown
): error is ErrorWithCode<'NETWORK_TIMEOUT' | 'ETIMEDOUT' | 'ECONNABORTED' | 'REQUEST_TIMEOUT'> {
  return hasErrorCode(
    error,
    ['NETWORK_TIMEOUT', 'ETIMEDOUT', 'ECONNABORTED', 'REQUEST_TIMEOUT'] as const,
    408
  );
}

/** True when the requested encrypted wallet vault is unavailable. */
export function isVaultNotFoundError(
  error: unknown
): error is ErrorWithCode<'VAULT_NOT_FOUND' | 'WALLET_VAULT_NOT_FOUND'> {
  return hasErrorCode(error, ['VAULT_NOT_FOUND', 'WALLET_VAULT_NOT_FOUND'] as const);
}

/** True when the requested Soroban contract is not deployed or cannot be located. */
export function isContractNotFoundError(
  error: unknown
): error is ErrorWithCode<'CONTRACT_NOT_FOUND' | 'CONTRACT_MISSING'> {
  return hasErrorCode(error, ['CONTRACT_NOT_FOUND', 'CONTRACT_MISSING'] as const, 404);
}

// ---------------------------------------------------------------------------
// Simulation errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a Soroban transaction simulation fails.
 *
 * The `diagnosticMessage` field contains the raw simulator output which can
 * be forwarded to logs or displayed in a debug view.
 */
export class SimulationFailedError extends AncoreSdkError {
  /** Raw error string returned by the Soroban RPC simulator. */
  public readonly diagnosticMessage: string;

  constructor(diagnosticMessage: string) {
    const actionable =
      'Transaction simulation failed. This usually means the contract ' +
      'invocation would revert on-chain. Check the diagnostic message for ' +
      'details and verify that your contract parameters are correct.';

    super('SIMULATION_FAILED', `${actionable}\n\nDiagnostic: ${diagnosticMessage}`);
    this.name = 'SimulationFailedError';
    this.diagnosticMessage = diagnosticMessage;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when simulation returns an expired/restored result that cannot be
 * assembled into a valid transaction.
 */
export class SimulationExpiredError extends AncoreSdkError {
  constructor() {
    super(
      'SIMULATION_EXPIRED',
      'The simulation result has expired or requires ledger entry restoration. ' +
        'Please retry the transaction. If this persists the contract storage ' +
        'may need to be restored first.'
    );
    this.name = 'SimulationExpiredError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Build errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the builder is used incorrectly (e.g., calling build() with
 * no operations, or adding a session key with invalid parameters).
 */
export class BuilderValidationError extends AncoreSdkError {
  constructor(message: string) {
    super('BUILDER_VALIDATION', message);
    this.name = 'BuilderValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an invalid or unknown retry preset name is requested.
 */
export class InvalidRetryPresetError extends AncoreSdkError {
  public readonly presetName?: string;

  constructor(presetName: string) {
    super('INVALID_RETRY_PRESET', `Unknown retry preset: ${presetName}`);
    this.name = 'InvalidRetryPresetError';
    this.presetName = presetName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when session-key management operations fail after delegating to the
 * account abstraction layer.
 */
export class SessionKeyManagementError extends AncoreSdkError {
  public readonly cause?: unknown;

  constructor(message: string, code: string = 'SESSION_KEY_MANAGEMENT_FAILED', cause?: unknown) {
    super(code, message);
    this.name = 'SessionKeyManagementError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Network / submission errors
// ---------------------------------------------------------------------------

/**
 * Thrown when transaction submission to the Stellar network fails.
 */
export class TransactionSubmissionError extends AncoreSdkError {
  /** The raw result XDR from the Stellar network, if available. */
  public readonly resultXdr?: string;

  constructor(message: string, resultXdr?: string) {
    const actionable =
      `Transaction submission failed: ${message}. ` +
      'Ensure the signing key has sufficient XLM for fees and that the ' +
      'network is reachable.';

    super('SUBMISSION_FAILED', actionable);
    this.name = 'TransactionSubmissionError';
    this.resultXdr = resultXdr;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Session-key execution errors
// ---------------------------------------------------------------------------

/**
 * Thrown when executeWithSessionKey() is called with invalid inputs.
 */
export class SessionKeyExecutionValidationError extends AncoreSdkError {
  constructor(message: string) {
    super('SESSION_KEY_EXECUTION_VALIDATION', message);
    this.name = 'SessionKeyExecutionValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when session-key execution fails after delegating to the execution layer.
 */
export class SessionKeyExecutionError extends AncoreSdkError {
  public readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(code, message);
    this.name = 'SessionKeyExecutionError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Payment Request errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a payment request payload is invalid or malformed.
 */
export class PaymentRequestValidationError extends AncoreSdkError {
  constructor(message: string) {
    super('PAYMENT_REQUEST_VALIDATION', message);
    this.name = 'PaymentRequestValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an amount string or number is invalid, out of range, or has too
 * much precision for the target asset.
 */
export class InvalidAmountError extends AncoreSdkError {
  constructor(message: string) {
    super('INVALID_AMOUNT', message);
    this.name = 'InvalidAmountError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// StrKey validation errors + helpers
// ---------------------------------------------------------------------------

import { StrKey } from '@stellar/stellar-sdk';

export type StrKeyErrorCode = 'INVALID_G_KEY' | 'INVALID_C_KEY';

export class StrKeyValidationError extends AncoreSdkError {
  constructor(
    public readonly code: StrKeyErrorCode,
    message: string,
    public readonly input?: string
  ) {
    super(code, message);
    this.name = 'StrKeyValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Assert that the provided value is a valid Stellar Ed25519 public key (G...)
 * Throws `StrKeyValidationError` with code `INVALID_G_KEY` on failure.
 */
export function assertValidEd25519PublicKey(publicKey: string): void {
  if (typeof publicKey !== 'string' || !StrKey.isValidEd25519PublicKey(publicKey)) {
    const snippet =
      typeof publicKey === 'string' ? publicKey.slice(0, 8) + '...' : String(publicKey);
    throw new StrKeyValidationError(
      'INVALID_G_KEY',
      `Invalid Ed25519 public key: expected G... format, got ${snippet}`,
      typeof publicKey === 'string' ? publicKey : undefined
    );
  }
}

/**
 * Assert that the provided value is a valid Stellar contract id (C...)
 * Throws `StrKeyValidationError` with code `INVALID_C_KEY` on failure.
 */
export function assertValidContractId(contractId: string): void {
  if (typeof contractId !== 'string' || !StrKey.isValidContract(contractId)) {
    const snippet =
      typeof contractId === 'string' ? contractId.slice(0, 8) + '...' : String(contractId);
    throw new StrKeyValidationError(
      'INVALID_C_KEY',
      `Invalid contract id: expected C... format, got ${snippet}`,
      typeof contractId === 'string' ? contractId : undefined
    );
  }
}

// ---------------------------------------------------------------------------
// Normalization helpers (canonical contract with UI/frontend)
// ---------------------------------------------------------------------------

/** Categories used by consumers (UI, telemetry) to classify errors */
export type ErrorCategory = 'NETWORK' | 'VALIDATION' | 'CONTRACT' | 'UNKNOWN';

/** Normalized error shape consumed by higher layers (extensions, UI) */
export interface NormalizedError {
  code: string;
  message: string;
  category: ErrorCategory;
  metadata?: Record<string, unknown>;
}

const NETWORK_PATTERNS = [
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /ENETUNREACH/,
  /EAI_AGAIN/,
  /Failed to fetch/i,
  /Network request failed/i,
  /net::ERR_/i,
];
const VALIDATION_PATTERNS = [
  /validation failed/i,
  /invalid/i,
  /malformed/i,
  /bad request/i,
  /type error/i,
];
const CONTRACT_PATTERNS = [
  /contract/i,
  /nonce/i,
  /insufficient/i,
  /revert/i,
  /execution reverted/i,
  /session key/i,
];

function detectCategoryFromCode(code: string): ErrorCategory {
  if (!code) return 'UNKNOWN';
  if (/^(ECONN|EAI_|ETIMEDOUT|ENOT|[45]\d{2}\b)/.test(code)) return 'NETWORK';
  if (
    /SIMULATION|SUBMISSION|SESSION_KEY|CONTRACT|INVALID|UNAUTHORIZED|INSUFFICIENT|NONCE|REVOKE|SESSION|INITIALIZED/.test(
      code
    )
  )
    return 'CONTRACT';
  if (/VALIDATION|MALFORMED|BAD_REQUEST|TYPE_ERROR/.test(code)) return 'VALIDATION';
  return 'UNKNOWN';
}

/**
 * Normalize arbitrary error-like values into a small, structured shape.
 * This function intentionally uses duck-typing so lower-level packages
 * don't need to import `@ancore/core-sdk` and circular deps are avoided.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error == null) {
    return { code: 'UNKNOWN', message: 'Unknown error', category: 'UNKNOWN' };
  }

  // Accept canonical objects from lower layers: { code, message, ... }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in (error as any)
  ) {
    const anyErr = error as any;
    const code =
      typeof anyErr.code === 'string' && anyErr.code.length > 0 ? anyErr.code : 'UNKNOWN';
    return {
      code,
      message: String(anyErr.message),
      category: detectCategoryFromCode(code),
      metadata: anyErr,
    };
  }

  // If it's an AncoreSdkError (core SDK errors carry `code`)
  if (error instanceof AncoreSdkError) {
    const code = (error as AncoreSdkError).code ?? 'UNKNOWN';
    return {
      code,
      message: error.message,
      category: detectCategoryFromCode(code),
      metadata: { name: error.name },
    };
  }

  // Standard Error instances
  if (error instanceof Error) {
    const anyErr = error as any;

    // If message contains an uppercase token code (e.g. ECONNREFUSED), prefer that
    const tokenMatch = error.message.match(/\b([A-Z][A-Z0-9_]{2,})\b/);
    if (tokenMatch) {
      const code = tokenMatch[1];
      return {
        code,
        message: error.message,
        category: detectCategoryFromCode(code),
        metadata: { name: error.name },
      };
    }

    // Known code property on many lower-layer errors (account-abstraction uses `code`)
    if (typeof anyErr.code === 'string' && anyErr.code.length > 0) {
      const code = anyErr.code as string;
      return {
        code,
        message: error.message,
        category: detectCategoryFromCode(code),
        metadata: { name: anyErr.name },
      };
    }

    // Stellar Transaction / Network shapes
    if ('resultXdr' in anyErr || 'resultCode' in anyErr) {
      const code = 'SUBMISSION_FAILED';
      return {
        code,
        message: error.message,
        category: 'CONTRACT',
        metadata: { resultCode: anyErr.resultCode, resultXdr: anyErr.resultXdr },
      };
    }

    // Heuristic pattern matching on the message or name
    const combined = `${error.name} ${error.message}`;
    if (NETWORK_PATTERNS.some((r) => r.test(combined))) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        category: 'NETWORK',
        metadata: { name: error.name },
      };
    }
    if (VALIDATION_PATTERNS.some((r) => r.test(combined))) {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message,
        category: 'VALIDATION',
        metadata: { name: error.name },
      };
    }
    if (CONTRACT_PATTERNS.some((r) => r.test(combined))) {
      return {
        code: 'CONTRACT_ERROR',
        message: error.message,
        category: 'CONTRACT',
        metadata: { name: error.name },
      };
    }

    return { code: 'UNKNOWN', message: error.message, category: 'UNKNOWN' };
  }

  // String or other
  if (typeof error === 'string') {
    const msg = error;
    if (NETWORK_PATTERNS.some((r) => r.test(msg)))
      return { code: 'NETWORK_ERROR', message: msg, category: 'NETWORK' };
    if (VALIDATION_PATTERNS.some((r) => r.test(msg)))
      return { code: 'VALIDATION_ERROR', message: msg, category: 'VALIDATION' };
    if (CONTRACT_PATTERNS.some((r) => r.test(msg)))
      return { code: 'CONTRACT_ERROR', message: msg, category: 'CONTRACT' };
    return { code: 'UNKNOWN', message: msg, category: 'UNKNOWN' };
  }

  // Fallback: stringify
  try {
    const msg = JSON.stringify(error);
    return { code: 'UNKNOWN', message: msg, category: 'UNKNOWN' };
  } catch {
    return { code: 'UNKNOWN', message: String(error), category: 'UNKNOWN' };
  }
}

// ---------------------------------------------------------------------------
// Typed error guards
// ---------------------------------------------------------------------------

export type CodedError = { code?: unknown };

function hasErrorCode(error: unknown, code: string): error is CodedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

export function isRateLimitError(error: unknown): error is CodedError {
  return hasErrorCode(error, 'RATE_LIMIT');
}

export function isInsufficientBalance(error: unknown): error is CodedError {
  return hasErrorCode(error, 'INSUFFICIENT_BALANCE');
}

export function isInvalidSignature(error: unknown): error is CodedError {
  return hasErrorCode(error, 'INVALID_SIGNATURE');
}

export function isNetworkError(error: unknown): error is CodedError {
  return hasErrorCode(error, 'NETWORK_ERROR');
}

export function isContractFailed(error: unknown): error is CodedError {
  return hasErrorCode(error, 'CONTRACT_FAILED');
}
