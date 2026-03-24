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
