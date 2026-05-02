/**
 * Custom error types for @ancore/stellar
 */

/**
 * Base error class for Stellar network errors
 */
export class StellarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StellarError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a network request fails
 */
export class NetworkError extends StellarError {
  public readonly cause?: Error;
  public readonly statusCode?: number;

  constructor(message: string, options?: { cause?: Error; statusCode?: number }) {
    super(message);
    this.name = 'NetworkError';
    this.cause = options?.cause;
    this.statusCode = options?.statusCode;
  }
}

/**
 * Error thrown when an account is not found on the network
 */
export class AccountNotFoundError extends StellarError {
  public readonly publicKey: string;

  constructor(publicKey: string) {
    super(`Account not found: ${publicKey}`);
    this.name = 'AccountNotFoundError';
    this.publicKey = publicKey;
  }
}

/**
 * Error thrown when a transaction submission fails
 */
export class TransactionError extends StellarError {
  public readonly resultCode?: string;
  public readonly resultXdr?: string;

  constructor(message: string, options?: { resultCode?: string; resultXdr?: string }) {
    super(message);
    this.name = 'TransactionError';
    this.resultCode = options?.resultCode;
    this.resultXdr = options?.resultXdr;
  }
}

/**
 * Error thrown when retry attempts are exhausted
 */
export class RetryExhaustedError extends StellarError {
  public readonly attempts: number;
  public readonly lastError?: Error;

  constructor(attempts: number, lastError?: Error) {
    super(`Retry exhausted after ${attempts} attempts`);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/** Map stellar package errors into a small canonical shape consumable by core-sdk */
export function toCanonicalError(err: unknown) {
  if (err instanceof StellarError) {
    const typedErr = err as StellarError & { resultCode?: string; resultXdr?: string };
    return {
      code: typedErr.resultCode ?? typedErr.name ?? 'STELLAR_ERROR',
      message: err.message,
      name: err.name,
      resultXdr: typedErr.resultXdr,
    };
  }
  if (err instanceof Error) {
    const typedErr = err as Error & { code?: string };
    return { code: typedErr.code ?? 'STELLAR_ERROR', message: err.message, name: err.name };
  }
  return { code: 'STELLAR_ERROR', message: String(err) };
}
