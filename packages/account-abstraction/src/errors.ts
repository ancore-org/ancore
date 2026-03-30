/**
 * Typed errors for account abstraction contract invocations.
 * Maps Soroban contract panics and host errors to TypeScript errors.
 */

/**
 * Base error for account contract operations.
 */
export class AccountContractError extends Error {
  readonly code: string;

  constructor(message: string, code: string = 'ACCOUNT_CONTRACT_ERROR') {
    super(message);
    this.name = 'AccountContractError';
    this.code = code;
    Object.setPrototypeOf(this, AccountContractError.prototype);
  }
}

/**
 * Thrown when initialize() is called on an already initialized account.
 * Maps to contract panic: "Already initialized"
 */
export class AlreadyInitializedError extends AccountContractError {
  constructor() {
    super('Account contract is already initialized', 'ALREADY_INITIALIZED');
    this.name = 'AlreadyInitializedError';
    Object.setPrototypeOf(this, AlreadyInitializedError.prototype);
  }
}

/**
 * Thrown when a read or write is attempted before initialize().
 * Maps to contract panic: "Not initialized"
 */
export class NotInitializedError extends AccountContractError {
  constructor() {
    super('Account contract is not initialized', 'NOT_INITIALIZED');
    this.name = 'NotInitializedError';
    Object.setPrototypeOf(this, NotInitializedError.prototype);
  }
}

/**
 * Thrown when execute() is called with a nonce that does not match the current nonce.
 * Maps to contract panic: "Invalid nonce"
 */
export class InvalidNonceError extends AccountContractError {
  constructor(message: string = 'Invalid nonce (replay or stale)') {
    super(message, 'INVALID_NONCE');
    this.name = 'InvalidNonceError';
    Object.setPrototypeOf(this, InvalidNonceError.prototype);
  }
}

/**
 * Thrown when the caller is not the owner (e.g. add_session_key without auth).
 * Maps to Soroban auth failure from require_auth().
 */
export class UnauthorizedError extends AccountContractError {
  constructor(message: string = 'Caller is not authorized') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Thrown when a session key is not found (e.g. get_session_key for unknown key).
 */
export class SessionKeyNotFoundError extends AccountContractError {
  constructor(publicKey?: string) {
    const msg = publicKey ? `Session key not found: ${publicKey}` : 'Session key not found';
    super(msg, 'SESSION_KEY_NOT_FOUND');
    this.name = 'SessionKeyNotFoundError';
    Object.setPrototypeOf(this, SessionKeyNotFoundError.prototype);
  }
}

/**
 * Thrown when contract invocation fails with an unexpected error (e.g. host/system).
 */
export class ContractInvocationError extends AccountContractError {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, 'CONTRACT_INVOCATION');
    this.name = 'ContractInvocationError';
    this.cause = cause;
    Object.setPrototypeOf(this, ContractInvocationError.prototype);
  }
}

/** Known contract panic messages for mapping host errors to typed errors */
export const CONTRACT_ERROR_MESSAGES = {
  ALREADY_INITIALIZED: 'Already initialized',
  NOT_INITIALIZED: 'Not initialized',
  INVALID_NONCE: 'Invalid nonce',
  SESSION_KEY_NOT_FOUND: 'Session key not found',
} as const;

export interface ContractErrorContext {
  sessionPublicKey?: string;
}

/**
 * Maps a contract error message or simulation/result error to a typed error.
 */
export function mapContractError(
  message: string,
  raw?: unknown,
  context: ContractErrorContext = {}
): AccountContractError {
  if (message.includes(CONTRACT_ERROR_MESSAGES.ALREADY_INITIALIZED)) {
    return new AlreadyInitializedError();
  }
  if (message.includes(CONTRACT_ERROR_MESSAGES.NOT_INITIALIZED)) {
    return new NotInitializedError();
  }
  if (message.includes(CONTRACT_ERROR_MESSAGES.INVALID_NONCE)) {
    return new InvalidNonceError(message);
  }
  if (
    message.includes(CONTRACT_ERROR_MESSAGES.SESSION_KEY_NOT_FOUND) ||
    (message.toLowerCase().includes('session key') && message.toLowerCase().includes('not found'))
  ) {
    return new SessionKeyNotFoundError(context.sessionPublicKey);
  }
  if (
    typeof message === 'string' &&
    (message.toLowerCase().includes('auth') || message.toLowerCase().includes('unauthorized'))
  ) {
    return new UnauthorizedError(message);
  }
  return new ContractInvocationError(message, raw);
}
