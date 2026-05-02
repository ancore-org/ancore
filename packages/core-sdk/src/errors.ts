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
  if (/^(ECONN|EAI_|ETIMEDOUT|ENOT|5\d{2}|4\d{2})/.test(code)) return 'NETWORK';
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
