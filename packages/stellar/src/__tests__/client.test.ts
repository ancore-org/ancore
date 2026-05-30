/**
 * Tests for StellarClient
 */

import type { Horizon, Transaction } from '@stellar/stellar-sdk';
import { StellarClient } from '../client';
import {
  AccountNotFoundError,
  NetworkError,
  RetryExhaustedError,
  TransactionError,
} from '../errors';
import * as retryModule from '../retry';
import type { RetryOptions } from '../retry';

type MockRpcServer = {
  getHealth: jest.Mock<Promise<unknown>, []>;
};

type MockHorizonServer = {
  loadAccount: jest.Mock<Promise<Horizon.AccountResponse>, [string]>;
  submitTransaction: jest.Mock<
    Promise<Horizon.HorizonApi.SubmitTransactionResponse>,
    [Transaction]
  >;
};

const mockRpcServers = new Map<string, MockRpcServer>();
const mockRpcServerConstructor = jest.fn((url: string) => {
  const server: MockRpcServer = {
    getHealth: jest.fn().mockResolvedValue({}),
  };
  mockRpcServers.set(url, server);
  return server;
});
const mockHorizonServerConstructor = jest.fn(() => ({
  loadAccount: jest.fn(),
  submitTransaction: jest.fn(),
}));

jest.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: jest.fn((url: string) => mockRpcServerConstructor(url)),
  },
  Horizon: {
    Server: jest.fn(() => mockHorizonServerConstructor()),
  },
}));

const mockAccountResponse: Horizon.AccountResponse = {
  id: 'GABC123',
  account_id: 'GABC123',
  sequence: '100',
  balances: [
    {
      balance: '1000.0000000',
      asset_type: 'native',
    },
    {
      balance: '500.0000000',
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQSTBE2EURIDVXL6B',
    },
  ],
  subentry_count: 2,
  last_modified_ledger: 12345,
  last_modified_time: '2024-01-01T00:00:00Z',
  thresholds: {
    low_threshold: 1,
    med_threshold: 2,
    high_threshold: 3,
  },
  flags: {
    auth_required: false,
    auth_revocable: false,
    auth_immutable: false,
  },
  signers: [],
  data: {},
  paging_token: 'token',
  _links: {
    self: { href: 'https://example.com' },
    transactions: { href: 'https://example.com' },
    operations: { href: 'https://example.com' },
    payments: { href: 'https://example.com' },
    effects: { href: 'https://example.com' },
    offers: { href: 'https://example.com' },
    trades: { href: 'https://example.com' },
    data: { href: 'https://example.com' },
  },
};

const getMockRpcServer = (url: string): MockRpcServer => {
  const server = mockRpcServers.get(url);

  if (!server) {
    throw new Error(`Missing mock RPC server for ${url}`);
  }

  return server;
};

const getHorizonMock = (client: StellarClient): MockHorizonServer => {
  return (client as unknown as { horizonServer: MockHorizonServer }).horizonServer;
};

const fastRetryOptions = { maxRetries: 0, baseDelayMs: 0 };

describe('StellarClient', () => {
  beforeEach(() => {
    mockRpcServers.clear();
    mockRpcServerConstructor.mockClear();
    mockHorizonServerConstructor.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a client with testnet network', () => {
      const client = new StellarClient({ network: 'testnet' });

      expect(client.getNetwork()).toBe('testnet');
      expect(client.getNetworkPassphrase()).toBe('Test SDF Network ; September 2015');
    });

    it('should create a client with mainnet network', () => {
      const client = new StellarClient({ network: 'mainnet' });

      expect(client.getNetwork()).toBe('mainnet');
      expect(client.getNetworkPassphrase()).toBe('Public Global Stellar Network ; September 2015');
    });

    it('should allow custom RPC URL', () => {
      const customRpcUrl = 'https://custom-rpc.example.com';
      const client = new StellarClient({
        network: 'testnet',
        rpcUrl: customRpcUrl,
      });

      expect(client.getNetwork()).toBe('testnet');
      expect(client.getRpcUrls()).toEqual([customRpcUrl]);
      expect(client.getCurrentRpcUrl()).toBe(customRpcUrl);
    });

    it('should allow custom RPC URLs in order', () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
      });

      expect(client.getRpcUrls()).toEqual(rpcUrls);
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[0]);
      expect(mockRpcServerConstructor).toHaveBeenNthCalledWith(1, rpcUrls[0]);
      expect(mockRpcServerConstructor).toHaveBeenNthCalledWith(2, rpcUrls[1]);
    });

    it('should ignore blank RPC URL entries and reject an unusable RPC URL list', () => {
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls: [' https://primary-rpc.example.com ', '', '   '],
      });

      expect(client.getRpcUrls()).toEqual(['https://primary-rpc.example.com']);
      expect(() => new StellarClient({ network: 'testnet', rpcUrls: ['', '   '] })).toThrow(
        NetworkError
      );
    });

    it('should allow custom network passphrase', () => {
      const customPassphrase = 'Custom Network ; January 2024';
      const client = new StellarClient({
        network: 'testnet',
        networkPassphrase: customPassphrase,
      });

      expect(client.getNetworkPassphrase()).toBe(customPassphrase);
    });

    it('should use the wallet retry preset by default', () => {
      const client = new StellarClient({ network: 'testnet' });
      const retryOptions = (client as unknown as { retryOptions: RetryOptions }).retryOptions;

      expect(retryOptions).toEqual(retryModule.resolveRetryOptions('wallet'));
    });

    it('should allow selecting the indexer retry preset', () => {
      const client = new StellarClient({
        network: 'testnet',
        retryPreset: 'indexer',
      });
      const retryOptions = (client as unknown as { retryOptions: RetryOptions }).retryOptions;

      expect(retryOptions).toEqual(retryModule.resolveRetryOptions('indexer'));
    });

    it('should allow custom retry options', () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: {
          maxRetries: 5,
          baseDelayMs: 500,
        },
      });
      const retryOptions = (client as unknown as { retryOptions: RetryOptions }).retryOptions;

      expect(retryOptions).toEqual({
        maxRetries: 5,
        baseDelayMs: 500,
        exponential: true,
      });
    });

    it('should merge custom retry options over the selected preset', () => {
      const client = new StellarClient({
        network: 'testnet',
        retryPreset: 'indexer',
        retryOptions: { baseDelayMs: 100 },
      });
      const retryOptions = (client as unknown as { retryOptions: RetryOptions }).retryOptions;

      expect(retryOptions).toEqual({
        maxRetries: 4,
        baseDelayMs: 100,
        exponential: true,
      });
    });

    it('should allow custom asset metadata cache TTL', async () => {
      const client = new StellarClient({
        network: 'testnet',
        assetMetadataCacheTtlMs: 1000,
      });

      jest.spyOn(client, 'getAccount').mockResolvedValue(mockAccountResponse);

      await client.getBalances('GABC123');

      expect(client.getAssetMetadataCacheMetrics()).toEqual({
        hits: 0,
        misses: 2,
        expirations: 0,
        size: 2,
      });
    });

    it('should create a client with local network defaults', () => {
      const client = new StellarClient({ network: 'local' });

      expect(client.getNetwork()).toBe('local');
      expect(client.getNetworkPassphrase()).toBe('Standalone Network ; February 2017');
      expect(client.getRpcUrls()).toEqual(['http://localhost:8000/soroban/rpc']);
    });
  });

  describe('getNetworkPassphrase', () => {
    it('should return the correct network passphrase', () => {
      const testnetClient = new StellarClient({ network: 'testnet' });
      const mainnetClient = new StellarClient({ network: 'mainnet' });

      expect(testnetClient.getNetworkPassphrase()).toBe('Test SDF Network ; September 2015');
      expect(mainnetClient.getNetworkPassphrase()).toBe(
        'Public Global Stellar Network ; September 2015'
      );
    });
  });

  describe('getNetwork', () => {
    it('should return the current network', () => {
      const client = new StellarClient({ network: 'testnet' });

      expect(client.getNetwork()).toBe('testnet');
    });
  });

  describe('getBalances', () => {
    it('should return balances for an account', async () => {
      const client = new StellarClient({ network: 'testnet' });

      jest.spyOn(client, 'getAccount').mockResolvedValue(mockAccountResponse);

      const balances = await client.getBalances('GABC123');

      expect(balances).toHaveLength(2);
      expect(balances[0]).toEqual({
        asset: 'XLM',
        balance: '1000.0000000',
        assetType: 'native',
      });
      expect(balances[1]).toEqual({
        asset: 'USDC:GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQSTBE2EURIDVXL6B',
        balance: '500.0000000',
        assetType: 'credit_alphanum4',
        assetCode: 'USDC',
        assetIssuer: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQSTBE2EURIDVXL6B',
      });
    });

    it('should throw AccountNotFoundError if account does not exist', async () => {
      const client = new StellarClient({ network: 'testnet' });

      jest.spyOn(client, 'getAccount').mockRejectedValue(new AccountNotFoundError('GABC123'));

      await expect(client.getBalances('GABC123')).rejects.toThrow(AccountNotFoundError);
    });

    it('should report asset metadata cache misses on first resolution', async () => {
      const client = new StellarClient({ network: 'testnet' });

      jest.spyOn(client, 'getAccount').mockResolvedValue(mockAccountResponse);

      await client.getBalances('GABC123');

      expect(client.getAssetMetadataCacheMetrics()).toEqual({
        hits: 0,
        misses: 2,
        expirations: 0,
        size: 2,
      });
    });

    it('should report asset metadata cache hits before TTL expiry', async () => {
      const client = new StellarClient({
        network: 'testnet',
        assetMetadataCacheTtlMs: 1000,
      });

      jest.spyOn(client, 'getAccount').mockResolvedValue(mockAccountResponse);

      await client.getBalances('GABC123');
      await client.getBalances('GABC123');

      expect(client.getAssetMetadataCacheMetrics()).toEqual({
        hits: 2,
        misses: 2,
        expirations: 0,
        size: 2,
      });
    });

    it('should invalidate asset metadata cache entries after TTL expiry', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      const client = new StellarClient({
        network: 'testnet',
        assetMetadataCacheTtlMs: 1000,
      });

      jest.spyOn(client, 'getAccount').mockResolvedValue(mockAccountResponse);

      await client.getBalances('GABC123');
      jest.advanceTimersByTime(1001);
      await client.getBalances('GABC123');

      expect(client.getAssetMetadataCacheMetrics()).toEqual({
        hits: 0,
        misses: 4,
        expirations: 2,
        size: 2,
      });
    });

    it('should skip caching when asset metadata cache TTL is zero', async () => {
      const client = new StellarClient({
        network: 'testnet',
        assetMetadataCacheTtlMs: 0,
      });

      jest.spyOn(client, 'getAccount').mockResolvedValue(mockAccountResponse);

      await client.getBalances('GABC123');
      await client.getBalances('GABC123');

      expect(client.getAssetMetadataCacheMetrics()).toEqual({
        hits: 0,
        misses: 4,
        expirations: 0,
        size: 0,
      });
    });
  });

  describe('getAccount', () => {
    it('should load an account from Horizon', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const horizon = getHorizonMock(client);
      horizon.loadAccount.mockResolvedValue(mockAccountResponse);

      await expect(client.getAccount('GABC123')).resolves.toEqual(mockAccountResponse);
      expect(horizon.loadAccount).toHaveBeenCalledWith('GABC123');
    });

    it('should throw AccountNotFoundError when Horizon reports not found', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const horizon = getHorizonMock(client);
      horizon.loadAccount.mockRejectedValue(new Error('Not Found'));

      await expect(client.getAccount('GABC123')).rejects.toThrow(AccountNotFoundError);
      expect(horizon.loadAccount).toHaveBeenCalledTimes(1);
    });

    it('should wrap unexpected Horizon errors as NetworkError', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const horizon = getHorizonMock(client);
      horizon.loadAccount.mockRejectedValue(new Error('Connection refused'));

      await expect(client.getAccount('GABC123')).rejects.toThrow(NetworkError);
    });

    it('should retry transient failures and eventually succeed', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 2, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      horizon.loadAccount
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(mockAccountResponse);

      await expect(client.getAccount('GABC123')).resolves.toEqual(mockAccountResponse);
      expect(horizon.loadAccount).toHaveBeenCalledTimes(2);
    });

    it('should retry Horizon 429 responses and eventually succeed', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      const rateLimitError = Object.assign(new Error('Rate limited'), {
        response: { status: 429 },
      });
      horizon.loadAccount
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockAccountResponse);

      await expect(client.getAccount('GABC123')).resolves.toEqual(mockAccountResponse);
      expect(horizon.loadAccount).toHaveBeenCalledTimes(2);
    });

    it('should not retry permanent Horizon 400 responses', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 2, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      const badRequestError = Object.assign(new Error('Bad request'), {
        response: { status: 400 },
      });
      horizon.loadAccount.mockRejectedValue(badRequestError);

      await expect(client.getAccount('GABC123')).rejects.toThrow(NetworkError);
      expect(horizon.loadAccount).toHaveBeenCalledTimes(1);
    });

    it('should surface RetryExhaustedError after persistent Horizon 429 responses', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      const rateLimitError = Object.assign(new Error('Rate limited'), {
        response: { status: 429 },
      });
      horizon.loadAccount.mockRejectedValue(rateLimitError);

      await expect(client.getAccount('GABC123')).rejects.toThrow(RetryExhaustedError);
      expect(horizon.loadAccount).toHaveBeenCalledTimes(2);
    });

    it('should unwrap RetryExhaustedError to the last NetworkError', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      horizon.loadAccount.mockRejectedValue(new Error('timeout'));

      await expect(client.getAccount('GABC123')).rejects.toThrow(NetworkError);
      expect(horizon.loadAccount).toHaveBeenCalledTimes(2);
    });

    it('should rethrow RetryExhaustedError when the last error is not unwrapped', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const exhausted = new RetryExhaustedError(2, new Error('unexpected'));
      jest.spyOn(retryModule, 'withRetry').mockRejectedValueOnce(exhausted);

      await expect(client.getAccount('GABC123')).rejects.toBe(exhausted);
    });
  });

  describe('submitTransaction', () => {
    const mockTransaction = { toXDR: () => 'xdr' } as unknown as Transaction;
    const mockSubmitResponse = {
      hash: 'abc123',
      ledger: 12345,
      envelope_xdr: 'envelope',
      result_xdr: 'result',
    } as Horizon.HorizonApi.SubmitTransactionResponse;

    it('should submit a signed transaction', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const horizon = getHorizonMock(client);
      horizon.submitTransaction.mockResolvedValue(mockSubmitResponse);

      await expect(client.submitTransaction(mockTransaction)).resolves.toEqual(mockSubmitResponse);
      expect(horizon.submitTransaction).toHaveBeenCalledWith(mockTransaction);
    });

    it('should throw TransactionError when Horizon returns result codes', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const horizon = getHorizonMock(client);
      horizon.submitTransaction.mockRejectedValue({
        response: {
          data: {
            extras: {
              result_codes: {
                transaction: 'tx_bad_seq',
              },
            },
          },
        },
      });

      await expect(client.submitTransaction(mockTransaction)).rejects.toThrow(TransactionError);
    });

    it('should wrap unexpected submission failures as NetworkError', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const horizon = getHorizonMock(client);
      horizon.submitTransaction.mockRejectedValue(new Error('socket hang up'));

      await expect(client.submitTransaction(mockTransaction)).rejects.toThrow(NetworkError);
    });

    it('should retry transient submission failures and eventually succeed', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      horizon.submitTransaction
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(mockSubmitResponse);

      await expect(client.submitTransaction(mockTransaction)).resolves.toEqual(mockSubmitResponse);
      expect(horizon.submitTransaction).toHaveBeenCalledTimes(2);
    });

    it('should retry Horizon 429 submission responses and eventually succeed', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      const rateLimitError = Object.assign(new Error('Rate limited'), {
        response: {
          status: 429,
          data: { title: 'Rate Limit Exceeded' },
        },
      });
      horizon.submitTransaction
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockSubmitResponse);

      await expect(client.submitTransaction(mockTransaction)).resolves.toEqual(mockSubmitResponse);
      expect(horizon.submitTransaction).toHaveBeenCalledTimes(2);
    });

    it('should unwrap RetryExhaustedError to the last TransactionError', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      const horizon = getHorizonMock(client);
      horizon.submitTransaction.mockRejectedValue({
        response: {
          data: {
            extras: {
              result_codes: {
                transaction: 'tx_bad_auth',
              },
            },
          },
        },
      });

      await expect(client.submitTransaction(mockTransaction)).rejects.toThrow(TransactionError);
    });

    it('should rethrow RetryExhaustedError when the last error is not unwrapped', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const exhausted = new RetryExhaustedError(2, new Error('unexpected'));
      jest.spyOn(retryModule, 'withRetry').mockRejectedValueOnce(exhausted);

      await expect(client.submitTransaction(mockTransaction)).rejects.toBe(exhausted);
    });
  });

  describe('fundWithFriendbot', () => {
    const publicKey = 'GABC123';
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should fund an account on testnet', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await expect(client.fundWithFriendbot(publicKey)).resolves.toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
      );
    });

    it('should reject Friendbot funding outside testnet', async () => {
      const client = new StellarClient({ network: 'mainnet', retryOptions: fastRetryOptions });

      await expect(client.fundWithFriendbot(publicKey)).rejects.toThrow(
        'Friendbot is only available on testnet'
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw NetworkError when Friendbot returns a non-OK response', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

      await expect(client.fundWithFriendbot(publicKey)).rejects.toThrow(NetworkError);
    });

    it('should wrap fetch failures as NetworkError', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

      await expect(client.fundWithFriendbot(publicKey)).rejects.toThrow(NetworkError);
    });

    it('should retry Friendbot failures and eventually succeed', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true });

      await expect(client.fundWithFriendbot(publicKey)).resolves.toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should unwrap RetryExhaustedError to the last NetworkError', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429 });

      await expect(client.fundWithFriendbot(publicKey)).rejects.toThrow(NetworkError);
    });

    it('should rethrow RetryExhaustedError when the last error is not unwrapped', async () => {
      const client = new StellarClient({ network: 'testnet', retryOptions: fastRetryOptions });
      const exhausted = new RetryExhaustedError(2, new Error('unexpected'));
      jest.spyOn(retryModule, 'withRetry').mockRejectedValueOnce(exhausted);

      await expect(client.fundWithFriendbot(publicKey)).rejects.toBe(exhausted);
    });
  });

  describe('isHealthy', () => {
    it('should return true if network is healthy', async () => {
      const client = new StellarClient({ network: 'testnet' });

      await expect(client.isHealthy()).resolves.toBe(true);
    });

    it('should fail over to fallback when the primary endpoint fails', async () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const fallback = getMockRpcServer(rpcUrls[1]);
      primary.getHealth.mockRejectedValue(new Error('primary down'));

      await expect(client.isHealthy()).resolves.toBe(true);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
      expect(fallback.getHealth).toHaveBeenCalledTimes(1);
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[1]);
    });

    it('should reuse the successful fallback endpoint on the next health check', async () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const fallback = getMockRpcServer(rpcUrls[1]);
      primary.getHealth.mockRejectedValueOnce(new Error('primary down'));

      await expect(client.isHealthy()).resolves.toBe(true);
      await expect(client.isHealthy()).resolves.toBe(true);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
      expect(fallback.getHealth).toHaveBeenCalledTimes(2);
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[1]);
    });

    it('should rotate from a later failed endpoint and recover on another endpoint', async () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const fallback = getMockRpcServer(rpcUrls[1]);
      primary.getHealth.mockRejectedValueOnce(new Error('primary down')).mockResolvedValue({});
      fallback.getHealth
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('fallback down'));

      await expect(client.isHealthy()).resolves.toBe(true);
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[1]);

      await expect(client.isHealthy()).resolves.toBe(true);

      expect(primary.getHealth).toHaveBeenCalledTimes(2);
      expect(fallback.getHealth).toHaveBeenCalledTimes(2);
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[0]);
    });

    it('should return false when all endpoints fail and recover on the next call', async () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const fallback = getMockRpcServer(rpcUrls[1]);
      primary.getHealth.mockRejectedValue(new Error('primary down'));
      fallback.getHealth.mockRejectedValue(new Error('fallback down'));

      await expect(client.isHealthy()).resolves.toBe(false);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
      expect(fallback.getHealth).toHaveBeenCalledTimes(1);
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[0]);

      primary.getHealth.mockReset().mockResolvedValue({});
      fallback.getHealth.mockClear();

      await expect(client.isHealthy()).resolves.toBe(true);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
      expect(fallback.getHealth).not.toHaveBeenCalled();
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[0]);
    });

    it('should stop retrying when RPC errors are not retryable', async () => {
      const rpcUrls = ['https://primary-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 3, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const clientError = Object.assign(new Error('bad request'), { statusCode: 400 });
      primary.getHealth.mockRejectedValue(clientError);

      await expect(client.isHealthy()).resolves.toBe(false);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should retry RPC requests on rate limiting responses', async () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const fallback = getMockRpcServer(rpcUrls[1]);
      const rateLimitError = Object.assign(new Error('rate limited'), { statusCode: 429 });
      primary.getHealth.mockRejectedValueOnce(rateLimitError);

      await expect(client.isHealthy()).resolves.toBe(true);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
      expect(fallback.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should classify HTTP status from alternate error shapes', async () => {
      const rpcUrls = ['https://primary-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      primary.getHealth.mockRejectedValue(
        Object.assign(new Error('server error'), { status: 503 })
      );

      await expect(client.isHealthy()).resolves.toBe(false);
      expect(primary.getHealth).toHaveBeenCalledTimes(2);
    });

    it('should retry when RPC rejections are not Error instances', async () => {
      const rpcUrls = ['https://primary-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      primary.getHealth.mockRejectedValue({
        response: { status: 502 },
      });

      await expect(client.isHealthy()).resolves.toBe(false);
      expect(primary.getHealth).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-network Stellar errors during RPC failover', async () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 3, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const fallback = getMockRpcServer(rpcUrls[1]);
      primary.getHealth.mockRejectedValue(new AccountNotFoundError('GABC123'));

      await expect(client.isHealthy()).resolves.toBe(false);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
      expect(fallback.getHealth).not.toHaveBeenCalled();
    });

    it('should keep using a single endpoint when failover is unavailable', async () => {
      const rpcUrls = ['https://only-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const only = getMockRpcServer(rpcUrls[0]);
      only.getHealth.mockRejectedValue(new Error('temporary outage'));

      await expect(client.isHealthy()).resolves.toBe(false);

      expect(only.getHealth).toHaveBeenCalledTimes(2);
      expect(client.getCurrentRpcUrl()).toBe(rpcUrls[0]);
    });

    it('should treat non-Error RPC rejections as retryable failures', async () => {
      const rpcUrls = ['https://primary-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 1, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      primary.getHealth.mockRejectedValue('rpc unavailable');

      await expect(client.isHealthy()).resolves.toBe(false);
      expect(primary.getHealth).toHaveBeenCalledTimes(2);
    });

    it('should classify NetworkError status codes during RPC failover', async () => {
      const rpcUrls = ['https://primary-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 3, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      primary.getHealth.mockRejectedValue(
        new NetworkError('upstream unavailable', { statusCode: 400 })
      );

      await expect(client.isHealthy()).resolves.toBe(false);
      expect(primary.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should classify NetworkError response status during RPC failover', async () => {
      const rpcUrls = ['https://primary-rpc.example.com', 'https://fallback-rpc.example.com'];
      const client = new StellarClient({
        network: 'testnet',
        rpcUrls,
        retryOptions: { maxRetries: 0, baseDelayMs: 0 },
      });
      const primary = getMockRpcServer(rpcUrls[0]);
      const fallback = getMockRpcServer(rpcUrls[1]);
      primary.getHealth.mockRejectedValueOnce(
        Object.assign(new Error('bad gateway'), {
          response: { status: 502 },
        })
      );

      await expect(client.isHealthy()).resolves.toBe(true);

      expect(primary.getHealth).toHaveBeenCalledTimes(1);
      expect(fallback.getHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('account activity pagination helpers', () => {
    it('should fetch account activity page and return next cursor', async () => {
      const client = new StellarClient({ network: 'testnet' });
      const records = [
        { id: '1', paging_token: 'pt-1' },
        { id: '2', paging_token: 'pt-2' },
      ] as unknown as Horizon.HorizonApi.OperationResponseType[];

      const call = jest.fn().mockResolvedValue({ records });
      const cursor = jest.fn().mockReturnValue({ call });
      const order = jest.fn().mockReturnValue({ call, cursor });
      const limit = jest.fn().mockReturnValue({ call, order, cursor });
      const forAccount = jest.fn().mockReturnValue({ call, limit, order, cursor });
      const operations = jest.fn().mockReturnValue({ forAccount });

      (client as unknown as { horizonServer: { operations: () => unknown } }).horizonServer = {
        operations,
      };

      const page = await client.getAccountActivityPage('GABC123', {
        cursor: 'start',
        limit: 2,
        order: 'desc',
      });

      expect(page.records).toHaveLength(2);
      expect(page.nextCursor).toBe('pt-2');
      expect(forAccount).toHaveBeenCalledWith('GABC123');
      expect(limit).toHaveBeenCalledWith(2);
      expect(order).toHaveBeenCalledWith('desc');
      expect(cursor).toHaveBeenCalledWith('start');
    });

    it('should iterate through pages until completion', async () => {
      const client = new StellarClient({ network: 'testnet' });
      const getAccountActivityPage = jest
        .spyOn(client, 'getAccountActivityPage')
        .mockResolvedValueOnce({
          records: [
            { id: '1', paging_token: 'pt-1' },
          ] as unknown as Horizon.HorizonApi.OperationResponseType[],
          nextCursor: 'pt-1',
        })
        .mockResolvedValueOnce({
          records: [
            { id: '2', paging_token: 'pt-2' },
          ] as unknown as Horizon.HorizonApi.OperationResponseType[],
          nextCursor: null,
        });

      const seen: string[] = [];
      for await (const op of client.iterateAccountActivity('GABC123', { limit: 1 })) {
        seen.push((op as unknown as { id: string }).id);
      }

      expect(seen).toEqual(['1', '2']);
      expect(getAccountActivityPage).toHaveBeenNthCalledWith(1, 'GABC123', {
        limit: 1,
        cursor: null,
      });
      expect(getAccountActivityPage).toHaveBeenNthCalledWith(2, 'GABC123', {
        limit: 1,
        cursor: 'pt-1',
      });
    });

    it('should return null nextCursor for empty page', async () => {
      const client = new StellarClient({ network: 'testnet' });
      const call = jest.fn().mockResolvedValue({ records: [] });
      const order = jest.fn().mockReturnValue({ call });
      const limit = jest.fn().mockReturnValue({ call, order });
      const forAccount = jest.fn().mockReturnValue({ call, limit, order });
      const operations = jest.fn().mockReturnValue({ forAccount });

      (client as unknown as { horizonServer: { operations: () => unknown } }).horizonServer = {
        operations,
      };

      const page = await client.getAccountActivityPage('GABC123');

      expect(page.records).toEqual([]);
      expect(page.nextCursor).toBeNull();
      expect(limit).toHaveBeenCalledWith(20);
      expect(order).toHaveBeenCalledWith('desc');
    });

    it('should surface RetryExhaustedError when activity page retries are exhausted', async () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: fastRetryOptions,
      });
      const call = jest.fn().mockRejectedValue(new Error('Horizon unavailable'));
      const order = jest.fn().mockReturnValue({ call });
      const limit = jest.fn().mockReturnValue({ call, order });
      const forAccount = jest.fn().mockReturnValue({ call, limit, order });
      const operations = jest.fn().mockReturnValue({ forAccount });

      (client as unknown as { horizonServer: { operations: () => unknown } }).horizonServer = {
        operations,
      };

      await expect(client.getAccountActivityPage('GABC123')).rejects.toMatchObject({
        name: 'RetryExhaustedError',
        lastError: expect.any(NetworkError),
      });
    });

    it('should stop iterating when a page has no records', async () => {
      const client = new StellarClient({ network: 'testnet' });
      const getAccountActivityPage = jest
        .spyOn(client, 'getAccountActivityPage')
        .mockResolvedValue({
          records: [],
          nextCursor: null,
        });

      const seen: string[] = [];
      for await (const op of client.iterateAccountActivity('GABC123')) {
        seen.push((op as unknown as { id: string }).id);
      }

      expect(seen).toEqual([]);
      expect(getAccountActivityPage).toHaveBeenCalledTimes(1);
    });
  });
});
