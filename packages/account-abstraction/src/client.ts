/**
 * @ancore/account-abstraction - Client with Network Retry Wrapper
 *
 * Provides a resilient client wrapper around AccountContract and Soroban RPC network methods.
 * Automatically retries on timeouts, connection resets, and 5xx server errors with exponential backoff and jitter.
 */

import { Address, hash, Networks, StrKey, xdr } from '@stellar/stellar-sdk';
import { AccountContract, type InvocationArgs } from './account-contract';
import {
  executeContract,
  simulateExecute,
  type ExecuteOptions,
  type ExecuteResult,
} from './execute';
import { NetworkError } from './errors';
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

export const ACCOUNT_CONTRACT_SALT: Buffer = Buffer.alloc(32, 0);

const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
  futurenet: Networks.FUTURENET,
  local: Networks.STANDALONE,
  standalone: Networks.STANDALONE,
};

/**
 * Deterministically derives the C... contract address for an owner public key.
 */
export function deriveAccountContractId(
  ownerPublicKey: string,
  network: string = 'testnet'
): string {
  const passphrase = NETWORK_PASSPHRASES[network.toLowerCase()] ?? Networks.TESTNET;
  const networkId = hash(Buffer.from(passphrase));
  const deployerAddress = new Address(ownerPublicKey);

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: deployerAddress.toScAddress(),
          salt: ACCOUNT_CONTRACT_SALT,
        })
      ),
    })
  );

  return StrKey.encodeContract(hash(preimage.toXDR()));
}

export interface SorobanRpcServer {
  getAccount(accountId: string): Promise<{ id: string; sequence: string }>;
  simulateTransaction(tx: unknown): Promise<unknown>;
  sendTransaction(tx: unknown): Promise<unknown>;
  getContractData?(...args: unknown[]): Promise<unknown>;
  getLedgerEntries?(...args: unknown[]): Promise<unknown>;
}

export interface AccountAbstractionClientOptions {
  contractId: string;
  ownerPublicKey?: string;
  server: SorobanRpcServer;
  networkPassphrase?: string;
  retryOptions?: ClientRetryOptions;
}

export interface CreateSmartAccountOptions {
  publicKey?: string;
  server: SorobanRpcServer;
  network?: string;
  contractId?: string;
  networkPassphrase?: string;
  retryOptions?: ClientRetryOptions;
}

/**
 * Convenience factory function to create an initialized AccountAbstractionClient.
 */
export function createSmartAccount(
  publicKeyOrOptions: string | CreateSmartAccountOptions,
  server?: SorobanRpcServer
): AccountAbstractionClient {
  let publicKey: string | undefined;
  let resolvedServer: SorobanRpcServer;
  let contractId: string | undefined;
  let network: string = 'testnet';
  let networkPassphrase: string | undefined;
  let retryOptions: ClientRetryOptions | undefined;

  if (typeof publicKeyOrOptions === 'string') {
    if (!server) {
      throw new Error('server is required when providing publicKey as first argument');
    }
    publicKey = publicKeyOrOptions;
    resolvedServer = server;
  } else {
    publicKey = publicKeyOrOptions.publicKey;
    resolvedServer = publicKeyOrOptions.server;
    contractId = publicKeyOrOptions.contractId;
    network = publicKeyOrOptions.network ?? 'testnet';
    networkPassphrase = publicKeyOrOptions.networkPassphrase;
    retryOptions = publicKeyOrOptions.retryOptions;
  }

  let resolvedContractId = contractId;
  let resolvedOwnerPublicKey = publicKey;

  if (!resolvedContractId && publicKey) {
    if (publicKey.startsWith('C') && StrKey.isValidContract(publicKey)) {
      resolvedContractId = publicKey;
      resolvedOwnerPublicKey = undefined;
    } else {
      resolvedContractId = deriveAccountContractId(publicKey, network);
    }
  }

  if (!resolvedContractId) {
    throw new Error('Either contractId or valid publicKey must be provided to createSmartAccount');
  }

  return new AccountAbstractionClient({
    contractId: resolvedContractId,
    ownerPublicKey: resolvedOwnerPublicKey,
    server: resolvedServer,
    networkPassphrase,
    retryOptions,
  });
}

function isNotFoundError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const candidate = err as {
      status?: unknown;
      statusCode?: unknown;
      response?: { status?: unknown; statusCode?: unknown };
      message?: unknown;
    };
    if (
      candidate.status === 404 ||
      candidate.statusCode === 404 ||
      candidate.response?.status === 404 ||
      candidate.response?.statusCode === 404
    ) {
      return true;
    }
    if (typeof candidate.message === 'string') {
      return /not\s*found|absent|entry\s*not\s*found/i.test(candidate.message);
    }
  }
  if (typeof err === 'string') {
    return /not\s*found|absent|entry\s*not\s*found/i.test(err);
  }
  return false;
}

/**
 * High-level Account Abstraction Client that wraps contract invocations and RPC network calls
 * with built-in exponential backoff and jitter retry mechanism.
 */
export class AccountAbstractionClient {
  readonly contractId: string;
  readonly ownerPublicKey?: string;
  readonly accountContract: AccountContract;
  readonly server: SorobanRpcServer;
  readonly networkPassphrase?: string;
  readonly retryOptions: ClientRetryOptions;

  constructor(options: AccountAbstractionClientOptions) {
    this.contractId = options.contractId;
    this.ownerPublicKey = options.ownerPublicKey;
    this.accountContract = new AccountContract(options.contractId);
    this.server = options.server;
    this.networkPassphrase = options.networkPassphrase;
    this.retryOptions = options.retryOptions ?? {};
  }

  static createSmartAccount(
    publicKeyOrOptions: string | CreateSmartAccountOptions,
    server?: SorobanRpcServer
  ): AccountAbstractionClient {
    return createSmartAccount(publicKeyOrOptions, server);
  }

  /**
   * Check whether the smart account contract is deployed on-chain by querying Soroban RPC.
   * Returns true if contract instance exists; returns false if 404 / absent entry.
   * Throws NetworkError on network timeouts or unrecoverable network failures.
   */
  async isAccountDeployed(
    contractId?: string,
    overrideOptions?: ClientRetryOptions
  ): Promise<boolean> {
    const targetContractId = contractId ?? this.contractId;
    if (!targetContractId) {
      throw new Error('Contract ID is required to check deployment');
    }

    try {
      return await this.withRetry(async () => {
        const s = this.server;
        if (typeof s.getContractData === 'function') {
          try {
            const res = await s.getContractData(
              targetContractId,
              xdr.ScVal.scvLedgerKeyContractInstance(),
              xdr.ContractDataDurability.persistent()
            );
            return res !== null && res !== undefined;
          } catch (err: unknown) {
            if (isNotFoundError(err)) {
              return false;
            }
            throw err;
          }
        }

        if (typeof s.getLedgerEntries === 'function') {
          try {
            const key = xdr.LedgerKey.contractData(
              new xdr.LedgerKeyContractData({
                contract: new Address(targetContractId).toScAddress(),
                key: xdr.ScVal.scvLedgerKeyContractInstance(),
                durability: xdr.ContractDataDurability.persistent(),
              })
            );
            const res = (await s.getLedgerEntries(key)) as
              | { entries?: unknown[] }
              | null
              | undefined;
            if (res && Array.isArray(res.entries)) {
              return res.entries.length > 0;
            }
            if (res && res.entries !== undefined && res.entries !== null) {
              return Boolean(res.entries);
            }
            return false;
          } catch (err: unknown) {
            if (isNotFoundError(err)) {
              return false;
            }
            throw err;
          }
        }

        if (typeof s.getAccount === 'function') {
          try {
            const acc = await s.getAccount(targetContractId);
            return acc !== null && acc !== undefined;
          } catch (err: unknown) {
            if (isNotFoundError(err)) {
              return false;
            }
            throw err;
          }
        }

        return false;
      }, overrideOptions);
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        return false;
      }
      const errName =
        typeof error === 'object' && error !== null && 'name' in error
          ? (error as { name?: string }).name
          : '';
      const errMsg = error instanceof Error ? error.message : String(error);

      if (isTransientError(error) || /timeout/i.test(errMsg) || errName === 'NetworkError') {
        throw new NetworkError(
          `Network timeout or failure while checking account deployment: ${errMsg}`,
          error
        );
      }
      throw error;
    }
  }

  initialize(owner?: string): InvocationArgs {
    return this.accountContract.initialize(owner ?? this.ownerPublicKey ?? this.contractId);
  }

  execute(
    to: string,
    fn: string,
    args: xdr.ScVal[],
    expectedNonce: number,
    sessionPubKey?: string | Uint8Array,
    signature?: string | Uint8Array
  ): InvocationArgs {
    return this.accountContract.execute(to, fn, args, expectedNonce, sessionPubKey, signature);
  }

  addSessionKey(
    publicKey: string | Uint8Array,
    permissions: number[],
    expiresAt: number
  ): InvocationArgs {
    return this.accountContract.addSessionKey(publicKey, permissions, expiresAt);
  }

  revokeSessionKey(publicKey: string | Uint8Array): InvocationArgs {
    return this.accountContract.revokeSessionKey(publicKey);
  }

  buildInvokeOperation(invocation: InvocationArgs) {
    return this.accountContract.buildInvokeOperation(invocation);
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
  async getOwner(sourceAccount?: string, overrideOptions?: ClientRetryOptions): Promise<string> {
    const resolvedSource = sourceAccount ?? this.ownerPublicKey ?? this.contractId;
    return this.withRetry(
      () =>
        this.accountContract.getOwner({
          server: this.server,
          sourceAccount: resolvedSource,
          networkPassphrase: this.networkPassphrase,
        }),
      overrideOptions
    );
  }

  /**
   * Get contract nonce with retry.
   */
  async getNonce(sourceAccount?: string, overrideOptions?: ClientRetryOptions): Promise<number> {
    const resolvedSource = sourceAccount ?? this.ownerPublicKey ?? this.contractId;
    return this.withRetry(
      () =>
        this.accountContract.getNonce({
          server: this.server,
          sourceAccount: resolvedSource,
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
