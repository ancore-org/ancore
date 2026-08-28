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
  public readonly retryable?: boolean;

  constructor(
    message: string,
    options?: { cause?: Error; statusCode?: number; retryable?: boolean }
  ) {
    super(message);
    this.name = 'NetworkError';
    this.cause = options?.cause;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable;
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
 * Error thrown when Soroban transaction simulation fails
 */
export class SimulationFailedError extends StellarError {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationFailedError';
  }
}

/**
 * Error thrown when a transaction submission fails
 */
type HorizonErrorPayload = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: unknown;
        };
        result_xdr?: string;
      };
      result_xdr?: string;
    };
  };
};

export interface TransactionErrorOptions {
  resultCode?: string;
  resultXdr?: string;
  operationResultCodes?: string[];
  statusCode?: number;
}

export class TransactionError extends StellarError {
  public readonly resultCode?: string;
  public readonly resultXdr?: string;
  public readonly operationResultCodes?: string[];
  public readonly statusCode?: number;

  constructor(message: string, options?: TransactionErrorOptions) {
    super(message);
    this.name = 'TransactionError';
    this.resultCode = options?.resultCode;
    this.resultXdr = options?.resultXdr;
    this.operationResultCodes = options?.operationResultCodes;
    this.statusCode = options?.statusCode;
  }

  static fromHorizonError(error: unknown): TransactionError | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const payload = error as HorizonErrorPayload;
    const data = payload.response?.data;
    const extras = data?.extras;
    const resultCodes = extras?.result_codes;
    const resultCode = resultCodes?.transaction;
    const operationResultCodes = Array.isArray(resultCodes?.operations)
      ? resultCodes.operations.filter((code): code is string => typeof code === 'string')
      : undefined;
    const resultXdr = extras?.result_xdr ?? data?.result_xdr;

    if (!resultCode && !operationResultCodes?.length && !resultXdr) {
      return null;
    }

    return new TransactionError(data?.message ?? 'Transaction submission failed', {
      resultCode,
      operationResultCodes,
      resultXdr,
      statusCode: payload.response?.status,
    });
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
