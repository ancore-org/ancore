/**
 * StellarClient - Network client for Stellar blockchain interactions
 */

import { rpc as StellarRpc, Horizon, TransactionBuilder } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';
import { simulateUnsignedTransaction, type ParsedSimulationResult } from './simulation';
import type { Network, NetworkConfig } from '@ancore/types';
import {
  StellarError,
  NetworkError,
  AccountNotFoundError,
  TransactionError,
  RetryExhaustedError,
} from './errors';
import { withRetry, resolveRetryOptions, type RetryOptions, type RetryPresetName } from './retry';

/** Supported Stellar network identifiers for client factory creation. */
export type NetworkId = Network;

const NETWORK_CONFIG: Record<
  Network,
  { rpcUrl: string; horizonUrl: string; networkPassphrase: string }
> = {
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
  mainnet: {
    rpcUrl: 'https://soroban.stellar.org',
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  },
  futurenet: {
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    networkPassphrase: 'Test SDF Future Network ; October 2022',
  },
  local: {
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    horizonUrl: 'http://localhost:8000',
    networkPassphrase: 'Standalone Network ; February 2017',
  },
};

/**
 * Create a StellarClient configured for the given network.
 *
 * @throws {NetworkError} when the network is not supported
 */
export function createStellarClient(
  network: NetworkId,
  config?: Omit<StellarClientConfig, 'network'>
): StellarClient {
  if (!(network in NETWORK_CONFIG)) {
    throw new NetworkError(`Unsupported network: ${network}`);
  }

  return new StellarClient({ network, ...config });
}

const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const DEFAULT_ASSET_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

export interface AssetMetadata {
  asset: string;
  assetType: string;
  assetCode?: string;
  assetIssuer?: string;
}

export interface Balance extends AssetMetadata {
  balance: string;
}

export interface AssetMetadataCacheMetrics {
  hits: number;
  misses: number;
  expirations: number;
  size: number;
}

export interface StellarClientConfig extends NetworkConfig {
  /** Retry preset tuned for wallet (conservative) or indexer (aggressive) call sites */
  retryPreset?: RetryPresetName;
  /** Custom retry options merged over the selected preset */
  retryOptions?: RetryOptions;
  /** Time in milliseconds to cache resolved asset metadata. Set to 0 to disable caching. */
  assetMetadataCacheTtlMs?: number;
}

export interface AccountActivityPageRequest {
  cursor?: string | null;
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface AccountActivityPage<TRecord> {
  records: TRecord[];
  nextCursor: string | null;
}

interface AssetMetadataCacheEntry {
  metadata: AssetMetadata;
  expiresAt: number;
}

/**
 * StellarClient provides methods for interacting with the Stellar network
 *
 * @example
 * ```typescript
 * const client = new StellarClient({ network: 'testnet' });
 * const account = await client.getAccount('GABC...');
 * const balances = await client.getBalances('GABC...');
 * ```
 */
export class StellarClient {
  private readonly rpcUrls: string[];
  private readonly rpcServers: StellarRpc.Server[];
  private readonly horizonServer: Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly network: Network;
  private readonly retryOptions: RetryOptions;
  private readonly assetMetadataCacheTtlMs: number;
  private readonly assetMetadataCache = new Map<string, AssetMetadataCacheEntry>();
  private assetMetadataCacheMetrics = {
    hits: 0,
    misses: 0,
    expirations: 0,
  };
  private currentRpcEndpointIndex = 0;

  constructor(config: StellarClientConfig) {
    this.network = config.network;

    if (!(config.network in NETWORK_CONFIG)) {
      throw new NetworkError(`Unsupported network: ${config.network}`);
    }

    const networkConfig = NETWORK_CONFIG[config.network];
    this.rpcUrls = this.resolveRpcUrls(config, networkConfig.rpcUrl);
    const horizonUrl = networkConfig.horizonUrl;
    this.networkPassphrase = config.networkPassphrase ?? networkConfig.networkPassphrase;

    this.rpcServers = this.rpcUrls.map((rpcUrl) => new StellarRpc.Server(rpcUrl));
    this.horizonServer = new Horizon.Server(horizonUrl);
    this.retryOptions = resolveRetryOptions(config.retryPreset ?? 'wallet', config.retryOptions);
    this.assetMetadataCacheTtlMs =
      config.assetMetadataCacheTtlMs ?? DEFAULT_ASSET_METADATA_CACHE_TTL_MS;
  }

  private resolveRpcUrls(config: StellarClientConfig, defaultRpcUrl: string): string[] {
    const configuredRpcUrls =
      config.rpcUrls && config.rpcUrls.length > 0 ? config.rpcUrls : undefined;
    const rpcUrls = configuredRpcUrls ?? (config.rpcUrl ? [config.rpcUrl] : [defaultRpcUrl]);
    const usableRpcUrls = rpcUrls
      .map((rpcUrl) => rpcUrl.trim())
      .filter((rpcUrl) => rpcUrl.length > 0);

    if (usableRpcUrls.length === 0) {
      throw new NetworkError('At least one usable RPC endpoint is required');
    }

    return usableRpcUrls;
  }

  private getCurrentRpcServer(): StellarRpc.Server {
    return this.rpcServers[this.currentRpcEndpointIndex];
  }

  private rotateRpcEndpoint(): boolean {
    if (this.rpcServers.length <= 1) {
      return false;
    }

    this.currentRpcEndpointIndex = (this.currentRpcEndpointIndex + 1) % this.rpcServers.length;
    return true;
  }

  private getRpcFailoverAttemptCount(): number {
    const maxRetries = this.retryOptions.maxRetries ?? 3;
    return Math.max(this.rpcServers.length, maxRetries + 1);
  }

  private getErrorStatusCode(error: unknown): number | undefined {
    if (error instanceof NetworkError) {
      return error.statusCode;
    }

    if (!error || typeof error !== 'object') {
      return undefined;
    }

    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }

    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }

    if (
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'status' in error.response &&
      typeof error.response.status === 'number'
    ) {
      return error.response.status;
    }

    return undefined;
  }

  private isRetryableStatusCode(statusCode: number): boolean {
    return statusCode === 429 || statusCode >= 500;
  }

  private isRetryableNetworkError(error: Error): boolean {
    if (error instanceof NetworkError && error.retryable !== undefined) {
      return error.retryable;
    }

    const statusCode = this.getErrorStatusCode(error);

    if (statusCode !== undefined) {
      return this.isRetryableStatusCode(statusCode);
    }

    return true;
  }

  private createHorizonNetworkError(message: string, error: unknown): NetworkError {
    const statusCode = this.getErrorStatusCode(error);
    const retryable = statusCode === undefined ? true : this.isRetryableStatusCode(statusCode);
    const rateLimitMessage = statusCode === 429 ? `${message}: rate limited by Horizon` : message;

    return new NetworkError(rateLimitMessage, {
      cause: error instanceof Error ? error : undefined,
      statusCode,
      retryable,
    });
  }

  private isRateLimitedNetworkError(error: Error): boolean {
    return error instanceof NetworkError && error.statusCode === 429;
  }

  private isRetryableHorizonError(error: Error): boolean {
    if (error instanceof StellarError && !(error instanceof NetworkError)) {
      return false;
    }

    return this.isRetryableNetworkError(error);
  }

  private isRetryableRpcError(error: Error): boolean {
    if (error instanceof StellarError && !(error instanceof NetworkError)) {
      return false;
    }

    return this.isRetryableNetworkError(error);
  }

  private async executeRpcWithFailover<T>(
    operation: (server: StellarRpc.Server) => Promise<T>
  ): Promise<T> {
    let lastError: Error | undefined;
    const attemptCount = this.getRpcFailoverAttemptCount();

    for (let attempt = 1; attempt <= attemptCount; attempt++) {
      try {
        return await operation(this.getCurrentRpcServer());
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryableRpcError(lastError)) {
          throw lastError;
        }

        this.rotateRpcEndpoint();
      }
    }

    throw lastError ?? new NetworkError('RPC request failed');
  }

  /**
   * Get the network passphrase
   */
  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  /**
   * Get the current network
   */
  getNetwork(): Network {
    return this.network;
  }

  getRpcUrls(): string[] {
    return [...this.rpcUrls];
  }

  getCurrentRpcUrl(): string {
    return this.rpcUrls[this.currentRpcEndpointIndex];
  }

  /**
   * Get asset metadata cache metrics.
   */
  getAssetMetadataCacheMetrics(): AssetMetadataCacheMetrics {
    return {
      ...this.assetMetadataCacheMetrics,
      size: this.assetMetadataCache.size,
    };
  }

  /**
   * Load an account from the network
   *
   * @param publicKey - The public key of the account to load
   * @returns The account data from the network
   * @throws AccountNotFoundError if the account doesn't exist
   * @throws NetworkError if the network request fails
   */
  async getAccount(publicKey: string): Promise<Horizon.AccountResponse> {
    try {
      return await withRetry(
        async () => {
          try {
            const account = await this.horizonServer.loadAccount(publicKey);
            return account;
          } catch (error) {
            const statusCode = this.getErrorStatusCode(error);
            if (
              statusCode === 404 ||
              (error instanceof Error && error.message.includes('Not Found'))
            ) {
              throw new AccountNotFoundError(publicKey);
            }
            throw this.createHorizonNetworkError('Failed to load account', error);
          }
        },
        {
          ...this.retryOptions,
          isRetryable: (error) => this.isRetryableHorizonError(error),
        }
      );
    } catch (error: unknown) {
      // If retry exhausted, throw the last error if it's one of our custom errors
      if (error instanceof RetryExhaustedError && error.lastError) {
        if (this.isRateLimitedNetworkError(error.lastError)) {
          throw error;
        }
        if (
          error.lastError instanceof AccountNotFoundError ||
          (error.lastError instanceof NetworkError && error.lastError.statusCode !== 429)
        ) {
          throw error.lastError;
        }
      }
      throw error;
    }
  }

  /**
   * Get balances for an account
   *
   * @param publicKey - The public key of the account
   * @returns Array of balances including XLM and tokens
   * @throws AccountNotFoundError if the account doesn't exist
   * @throws NetworkError if the network request fails
   */
  async getBalances(publicKey: string): Promise<Balance[]> {
    const account = await this.getAccount(publicKey);

    return account.balances.map((balance) => ({
      ...this.resolveAssetMetadata(balance),
      balance: balance.balance,
    }));
  }

  /**
   * Fetch a paginated account activity page from Horizon operations endpoint.
   */
  async getAccountActivityPage(
    publicKey: string,
    request: AccountActivityPageRequest = {}
  ): Promise<AccountActivityPage<Horizon.HorizonApi.OperationResponseType>> {
    const { cursor = null, limit = 20, order = 'desc' } = request;

    return withRetry(
      async () => {
        try {
          const builder = this.horizonServer
            .operations()
            .forAccount(publicKey)
            .limit(limit)
            .order(order);

          const page = cursor ? await builder.cursor(cursor).call() : await builder.call();
          // Cast via unknown to avoid overlap errors between Horizon response types
          const records = page.records as unknown as Horizon.HorizonApi.OperationResponseType[];
          const nextCursor = this.getNextCursor(records);

          return { records, nextCursor };
        } catch (error) {
          throw this.createHorizonNetworkError('Failed to fetch account activity page', error);
        }
      },
      {
        ...this.retryOptions,
        isRetryable: (error) => this.isRetryableHorizonError(error),
      }
    );
  }

  /**
   * Async iterator for account activity pagination.
   */
  async *iterateAccountActivity(
    publicKey: string,
    request: AccountActivityPageRequest = {}
  ): AsyncGenerator<Horizon.HorizonApi.OperationResponseType, void, unknown> {
    let cursor = request.cursor ?? null;

    while (true) {
      const page = await this.getAccountActivityPage(publicKey, { ...request, cursor });
      for (const record of page.records) {
        yield record;
      }

      if (!page.nextCursor || page.records.length === 0) {
        return;
      }
      cursor = page.nextCursor;
    }
  }

  private getNextCursor(records: unknown[]): string | null {
    if (records.length === 0) {
      return null;
    }
    const last = records[records.length - 1] as { paging_token?: string };
    return last?.paging_token ?? null;
  }

  private resolveAssetMetadata(balance: Horizon.HorizonApi.BalanceLine): AssetMetadata {
    const cacheKey = this.getAssetMetadataCacheKey(balance);
    const cached = this.assetMetadataCache.get(cacheKey);
    const now = Date.now();

    if (cached) {
      if (cached.expiresAt > now) {
        this.assetMetadataCacheMetrics.hits += 1;
        return cached.metadata;
      }

      this.assetMetadataCache.delete(cacheKey);
      this.assetMetadataCacheMetrics.expirations += 1;
    }

    this.assetMetadataCacheMetrics.misses += 1;

    const metadata = this.createAssetMetadata(balance);
    if (this.assetMetadataCacheTtlMs > 0) {
      this.assetMetadataCache.set(cacheKey, {
        metadata,
        expiresAt: now + this.assetMetadataCacheTtlMs,
      });
    }

    return metadata;
  }

  private getAssetMetadataCacheKey(balance: Horizon.HorizonApi.BalanceLine): string {
    if (balance.asset_type === 'native') {
      return 'native:XLM';
    }

    const creditBalance = balance as Horizon.HorizonApi.BalanceLineAsset;
    return `${creditBalance.asset_type}:${creditBalance.asset_code}:${creditBalance.asset_issuer}`;
  }

  private createAssetMetadata(balance: Horizon.HorizonApi.BalanceLine): AssetMetadata {
    if (balance.asset_type === 'native') {
      return {
        asset: 'XLM',
        assetType: 'native',
      };
    }

    const creditBalance = balance as Horizon.HorizonApi.BalanceLineAsset;
    return {
      asset: `${creditBalance.asset_code}:${creditBalance.asset_issuer}`,
      assetType: creditBalance.asset_type,
      assetCode: creditBalance.asset_code,
      assetIssuer: creditBalance.asset_issuer,
    };
  }

  /**
   * Simulate a Soroban transaction against the RPC server.
   *
   * When passed a `Transaction`, returns the raw Soroban RPC response (for
   * assemble/submit flows). When passed unsigned XDR, returns a parsed
   * wallet-friendly simulation result.
   */
  async simulateTransaction(
    transaction: Transaction
  ): Promise<StellarRpc.Api.SimulateTransactionResponse>;
  async simulateTransaction(unsignedXdr: string): Promise<ParsedSimulationResult>;
  async simulateTransaction(
    transactionOrXdr: Transaction | string
  ): Promise<StellarRpc.Api.SimulateTransactionResponse | ParsedSimulationResult> {
    if (typeof transactionOrXdr === 'string') {
      return simulateUnsignedTransaction(transactionOrXdr, this.networkPassphrase, (transaction) =>
        this.executeRpcWithFailover((server) => server.simulateTransaction(transaction))
      ).catch((error) => ({
        fee: '0.0000000',
        resourceLimits: { cpuInsn: 0, memBytes: 0 },
        authEntries: [],
        footprint: '',
        error: error instanceof Error ? error.message : 'Simulation request failed',
      }));
    }

    try {
      return await withRetry(
        async () =>
          this.executeRpcWithFailover((rpcServer) =>
            rpcServer.simulateTransaction(transactionOrXdr)
          ),
        {
          ...this.retryOptions,
          isRetryable: (error) => this.isRetryableRpcError(error),
        }
      );
    } catch (error: unknown) {
      if (error instanceof RetryExhaustedError && error.lastError) {
        if (error.lastError instanceof NetworkError) {
          throw error.lastError;
        }
      }
      throw error;
    }
  }

  /**
   * Submit a signed transaction to the network
   *
   * @param transaction - The signed transaction to submit
   * @returns The transaction response from the network
   * @throws TransactionError if the transaction fails
   * @throws NetworkError if the network request fails
   */
  async submitTransaction(
    transaction: Transaction | string,
    options?: { retryOptions?: RetryOptions }
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    let signedTransaction: Transaction;
    try {
      signedTransaction = this.resolveSignedTransaction(transaction);
    } catch (error) {
      throw new NetworkError('Invalid signed transaction XDR', {
        cause: error instanceof Error ? error : undefined,
      });
    }

    const callerIsRetryable = options?.retryOptions?.isRetryable ?? this.retryOptions.isRetryable;
    const retryOptions: RetryOptions = {
      maxRetries: 4, // 5 attempts total
      exponential: true,
      ...this.retryOptions,
      ...options?.retryOptions,
      isRetryable: (error) => {
        if (error instanceof TransactionError) {
          return false;
        }

        if (callerIsRetryable) {
          return callerIsRetryable(error);
        }

        const statusCode = this.getErrorStatusCode(error);
        return statusCode === undefined || statusCode === 429 || statusCode >= 500;
      },
    };

    try {
      return await withRetry(async () => {
        try {
          const response = await this.horizonServer.submitTransaction(signedTransaction);
          return response;
        } catch (error) {
          const transactionError = TransactionError.fromHorizonError(error);
          if (transactionError) {
            throw transactionError;
          }
          throw this.createHorizonNetworkError('Failed to submit transaction', error);
        }
      }, retryOptions);
    } catch (error: unknown) {
      if (error instanceof RetryExhaustedError && error.lastError) {
        if (this.isRateLimitedNetworkError(error.lastError)) {
          throw error;
        }
        if (
          error.lastError instanceof TransactionError ||
          error.lastError instanceof NetworkError
        ) {
          throw error.lastError;
        }
      }
      throw error;
    }
  }

  private resolveSignedTransaction(transaction: Transaction | string): Transaction {
    if (typeof transaction !== 'string') {
      return transaction;
    }

    return TransactionBuilder.fromXDR(transaction, this.networkPassphrase) as Transaction;
  }

  /**
   * Fund an account using Friendbot (testnet only)
   *
   * @param publicKey - The public key of the account to fund
   * @returns True if funding was successful
   * @throws NetworkError if not on testnet or if the request fails
   */
  async fundWithFriendbot(publicKey: string): Promise<boolean> {
    if (this.network !== 'testnet') {
      throw new NetworkError('Friendbot is only available on testnet');
    }

    try {
      return await withRetry(async () => {
        try {
          const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);

          if (!response.ok) {
            throw new NetworkError('Friendbot request failed', {
              statusCode: response.status,
            });
          }

          return true;
        } catch (error) {
          if (error instanceof NetworkError) {
            throw error;
          }
          throw new NetworkError('Failed to fund account with Friendbot', {
            cause: error instanceof Error ? error : undefined,
          });
        }
      }, this.retryOptions);
    } catch (error: unknown) {
      if (error instanceof RetryExhaustedError && error.lastError) {
        if (error.lastError instanceof NetworkError) {
          throw error.lastError;
        }
      }
      throw error;
    }
  }

  /**
   * Check if the network is healthy
   *
   * @returns True if the network is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.executeRpcWithFailover((rpcServer) => rpcServer.getHealth());
      return true;
    } catch {
      return false;
    }
  }
}
