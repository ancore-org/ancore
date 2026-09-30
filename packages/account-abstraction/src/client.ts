/**
 * @ancore/account-abstraction - Client with Network Retry Wrapper
 *
 * Provides a resilient client wrapper around AccountContract and Soroban RPC network methods.
 * Automatically retries on timeouts, connection resets, and 5xx server errors with exponential backoff and jitter.
 */

import { AccountContract } from './account-contract';
import {
  executeContract,
  simulateExecute,
  type ExecuteOptions,
  type ExecuteResult,
} from './execute';
import type { SessionKey } from '@ancore/types';

export interface ClientRetryOptions {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms (default: 100) */
  baseDelayMs?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelayMs?: number;
  /** Whether to use exponential backoff (default: true) */
  exponential?: boolean;
  /** Jitter ratio or boolean (default: true for ±10%) */
  jitter?: boolean | number;
  /** Custom error filter */
  isRetryable?: (error: unknown) => boolean;
  /** Callback before retry */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const TRANSIENT_ERROR_CODES = new Set([
  'TIMEOUT',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'NETWORK_ERROR',
]);

const TRANSIENT_PATTERNS = [
  /timeout/i,
  /timed\s*out/i,
  /econnreset/i,
  /econnrefused/i,
  /enotfound/i,
  /enetunreach/i,
  /failed to fetch/i,
  /network\s*(request\s*)?failed/i,
  /socket hung up/i,
  /service unavailable/i,
  /gateway timeout/i,
  /bad gateway/i,
  /\b50[0234]\b/,
];

export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      response?: { status?: unknown; statusCode?: unknown };
    };

    const status =
      (typeof candidate.status === 'number' ? candidate.status : undefined) ??
      (typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined) ??
      (typeof candidate.response?.status === 'number' ? candidate.response.status : undefined) ??
      (typeof candidate.response?.statusCode === 'number'
        ? candidate.response.statusCode
        : undefined);

    if (
      status !== undefined &&
      ((status >= 500 && status < 600) || status === 429 || status === 408)
    ) {
      return true;
    }

    if (
      typeof candidate.code === 'string' &&
      TRANSIENT_ERROR_CODES.has(candidate.code.toUpperCase())
    ) {
      return true;
    }
  }

  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : String(error);

  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(message));
}

export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = 100,
  maxDelayMs: number = 10_000,
  jitter: boolean | number = true,
  exponential: boolean = true
): number {
  const safeAttempt = Math.max(0, attempt);
  let delay = exponential
    ? Math.min(baseDelayMs * Math.pow(2, safeAttempt), maxDelayMs)
    : Math.min(baseDelayMs, maxDelayMs);

  if (jitter) {
    const factor = typeof jitter === 'number' ? Math.abs(jitter) : 0.1;
    const random = (Math.random() * 2 - 1) * factor;
    delay = delay * (1 + random);
  }

  return Math.max(0, Math.min(Math.round(delay), maxDelayMs));
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  options: ClientRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 10_000;
  const exponential = options.exponential ?? true;
  const jitter = options.jitter ?? true;
  const isRetryable = options.isRetryable ?? isTransientError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries) {
        break;
      }

      if (!isRetryable(error)) {
        throw error;
      }

      const delayMs = calculateBackoff(attempt, baseDelayMs, maxDelayMs, jitter, exponential);

      if (options.onRetry) {
        try {
          options.onRetry(attempt + 1, error, delayMs);
        } catch {
          // ignore callback error
        }
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export interface SorobanRpcServer {
  getAccount(accountId: string): Promise<{ id: string; sequence: string }>;
  simulateTransaction(tx: unknown): Promise<unknown>;
  sendTransaction(tx: unknown): Promise<unknown>;
}

export interface AccountAbstractionClientOptions {
  contractId: string;
  server: SorobanRpcServer;
  networkPassphrase?: string;
  retryOptions?: ClientRetryOptions;
}

/**
 * High-level Account Abstraction Client that wraps contract invocations and RPC network calls
 * with built-in exponential backoff and jitter retry mechanism.
 */
export class AccountAbstractionClient {
  readonly contractId: string;
  readonly accountContract: AccountContract;
  readonly server: SorobanRpcServer;
  readonly networkPassphrase?: string;
  readonly retryOptions: ClientRetryOptions;

  constructor(options: AccountAbstractionClientOptions) {
    this.contractId = options.contractId;
    this.accountContract = new AccountContract(options.contractId);
    this.server = options.server;
    this.networkPassphrase = options.networkPassphrase;
    this.retryOptions = options.retryOptions ?? {};
  }

  /**
   * Execute an operation with retry logic.
   */
  async withRetry<T>(fn: () => Promise<T>, overrideOptions?: ClientRetryOptions): Promise<T> {
    return withNetworkRetry(fn, {
      ...this.retryOptions,
      ...overrideOptions,
    });
  }

  /**
   * Fetch account data with automatic retry on transient network errors.
   */
  async getAccount(
    accountId: string,
    overrideOptions?: ClientRetryOptions
  ): Promise<{ id: string; sequence: string }> {
    return this.withRetry(() => this.server.getAccount(accountId), overrideOptions);
  }

  /**
   * Simulate a transaction with automatic retry on transient network errors.
   */
  async simulateTransaction(tx: unknown, overrideOptions?: ClientRetryOptions): Promise<unknown> {
    return this.withRetry(() => this.server.simulateTransaction(tx), overrideOptions);
  }

  /**
   * Send a transaction with automatic retry on transient network errors.
   */
  async sendTransaction(tx: unknown, overrideOptions?: ClientRetryOptions): Promise<unknown> {
    return this.withRetry(() => this.server.sendTransaction(tx), overrideOptions);
  }

  /**
   * Get contract owner address with retry.
   */
  async getOwner(sourceAccount: string, overrideOptions?: ClientRetryOptions): Promise<string> {
    return this.withRetry(
      () =>
        this.accountContract.getOwner({
          server: this.server,
          sourceAccount,
          networkPassphrase: this.networkPassphrase,
        }),
      overrideOptions
    );
  }

  /**
   * Get contract nonce with retry.
   */
  async getNonce(sourceAccount: string, overrideOptions?: ClientRetryOptions): Promise<number> {
    return this.withRetry(
      () =>
        this.accountContract.getNonce({
          server: this.server,
          sourceAccount,
          networkPassphrase: this.networkPassphrase,
        }),
      overrideOptions
    );
  }

  /**
   * Get contract version with retry.
   */
  async getVersion(sourceAccount: string, overrideOptions?: ClientRetryOptions): Promise<number> {
    return this.withRetry(
      () =>
        this.accountContract.getVersion({
          server: this.server,
          sourceAccount,
          networkPassphrase: this.networkPassphrase,
        }),
      overrideOptions
    );
  }

  /**
   * Get session key details with retry.
   */
  async getSessionKey(
    publicKey: string | Uint8Array,
    sourceAccount: string,
    overrideOptions?: ClientRetryOptions
  ): Promise<SessionKey | null> {
    return this.withRetry(
      () =>
        this.accountContract.getSessionKey(publicKey, {
          server: this.server,
          sourceAccount,
          networkPassphrase: this.networkPassphrase,
        }),
      overrideOptions
    );
  }

  /**
   * Execute contract method with retry on network submission and simulation.
   */
  async executeContract<T = unknown>(
    to: string,
    functionName: string,
    args: unknown[],
    expectedNonce: number,
    options: Omit<ExecuteOptions, 'server'>,
    overrideOptions?: ClientRetryOptions
  ): Promise<ExecuteResult<T>> {
    return this.withRetry(
      () =>
        executeContract(this.accountContract, to, functionName, args, expectedNonce, {
          ...options,
          server: this.server,
        }),
      overrideOptions
    );
  }

  /**
   * Simulate execute method with retry.
   */
  async simulateExecute<T = unknown>(
    to: string,
    functionName: string,
    args: unknown[],
    expectedNonce: number,
    options: Omit<ExecuteOptions, 'server' | 'fee'>,
    overrideOptions?: ClientRetryOptions
  ): Promise<T> {
    return this.withRetry(
      () =>
        simulateExecute(this.accountContract, to, functionName, args, expectedNonce, {
          ...options,
          server: this.server,
        }),
      overrideOptions
    );
  }
}
