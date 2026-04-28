/**
 * StellarClient - Network client for Stellar blockchain interactions
 */

import { rpc as StellarRpc, Horizon } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';
import type { Network, NetworkConfig } from '@ancore/types';
import {
  NetworkError,
  AccountNotFoundError,
  TransactionError,
  RetryExhaustedError,
} from './errors';
import { withRetry, type RetryOptions } from './retry';

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
  local: {
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    horizonUrl: 'http://localhost:8000',
    networkPassphrase: 'Standalone Network ; February 2017',
  },
};

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
  /** Custom retry options for network requests */
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
  private readonly rpcServer: StellarRpc.Server;
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

  constructor(config: StellarClientConfig) {
    this.network = config.network;

    const networkConfig = NETWORK_CONFIG[config.network];
    const rpcUrl = config.rpcUrl ?? networkConfig.rpcUrl;
    const horizonUrl = networkConfig.horizonUrl;
    this.networkPassphrase = config.networkPassphrase ?? networkConfig.networkPassphrase;

    this.rpcServer = new StellarRpc.Server(rpcUrl);
    this.horizonServer = new Horizon.Server(horizonUrl);
    this.retryOptions = config.retryOptions ?? {
      maxRetries: 3,
      baseDelayMs: 1000,
      exponential: true,
    };
    this.assetMetadataCacheTtlMs =
      config.assetMetadataCacheTtlMs ?? DEFAULT_ASSET_METADATA_CACHE_TTL_MS;
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
            if (error instanceof Error && error.message.includes('Not Found')) {
              throw new AccountNotFoundError(publicKey);
            }
            throw new NetworkError('Failed to load account', {
              cause: error instanceof Error ? error : undefined,
            });
          }
        },
        {
          ...this.retryOptions,
          isRetryable: (error) => !(error instanceof AccountNotFoundError),
        }
      );
    } catch (error: unknown) {
      // If retry exhausted, throw the last error if it's one of our custom errors
      if (error instanceof RetryExhaustedError && error.lastError) {
        if (
          error.lastError instanceof AccountNotFoundError ||
          error.lastError instanceof NetworkError
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
  ): Promise<AccountActivityPage<Horizon.HorizonApi.OperationResponse>> {
    const { cursor = null, limit = 20, order = 'desc' } = request;

    return withRetry(async () => {
      try {
        const builder = this.horizonServer
          .operations()
          .forAccount(publicKey)
          .limit(limit)
          .order(order);

        const page = cursor ? await builder.cursor(cursor).call() : await builder.call();
        const records = page.records as Horizon.HorizonApi.OperationResponse[];
        const nextCursor = this.getNextCursor(records);

        return { records, nextCursor };
      } catch (error) {
        throw new NetworkError('Failed to fetch account activity page', {
          cause: error instanceof Error ? error : undefined,
        });
      }
    }, this.retryOptions);
  }

  /**
   * Async iterator for account activity pagination.
   */
  async *iterateAccountActivity(
    publicKey: string,
    request: AccountActivityPageRequest = {}
  ): AsyncGenerator<Horizon.HorizonApi.OperationResponse, void, unknown> {
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

  private getNextCursor(
    records: Array<{ paging_token?: string }>
  ): string | null {
    if (records.length === 0) {
      return null;
    }
    const last = records[records.length - 1];
    return last.paging_token ?? null;
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
   * Submit a signed transaction to the network
   *
   * @param transaction - The signed transaction to submit
   * @returns The transaction response from the network
   * @throws TransactionError if the transaction fails
   * @throws NetworkError if the network request fails
   */
  async submitTransaction(
    transaction: Transaction
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    try {
      return await withRetry(async () => {
        try {
          const response = await this.horizonServer.submitTransaction(transaction);
          return response;
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'response' in error &&
            error.response &&
            typeof error.response === 'object' &&
            'data' in error.response
          ) {
            const data = error.response.data as {
              extras?: { result_codes?: { transaction?: string } };
            };
            throw new TransactionError('Transaction submission failed', {
              resultCode: data?.extras?.result_codes?.transaction,
            });
          }
          throw new NetworkError('Failed to submit transaction', {
            cause: error instanceof Error ? error : undefined,
          });
        }
      }, this.retryOptions);
    } catch (error: unknown) {
      if (error instanceof RetryExhaustedError && error.lastError) {
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
      await this.rpcServer.getHealth();
      return true;
    } catch {
      return false;
    }
  }
}
