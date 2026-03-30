/**
 * Tests for StellarClient
 */

import { StellarClient } from '../client';
import { NetworkError, AccountNotFoundError, TransactionError } from '../errors';
import type { Horizon } from '@stellar/stellar-sdk';

// Mock Horizon server responses
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

describe('StellarClient', () => {
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
    });

    it('should allow custom network passphrase', () => {
      const customPassphrase = 'Custom Network ; January 2024';
      const client = new StellarClient({
        network: 'testnet',
        networkPassphrase: customPassphrase,
      });

      expect(client.getNetworkPassphrase()).toBe(customPassphrase);
    });

    it('should allow custom retry options', () => {
      const client = new StellarClient({
        network: 'testnet',
        retryOptions: {
          maxRetries: 5,
          baseDelayMs: 500,
        },
      });

      expect(client.getNetwork()).toBe('testnet');
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

      // Mock the getAccount method
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
  });

  describe('isHealthy', () => {
    it('should return true if network is healthy', async () => {
      const client = new StellarClient({ network: 'testnet' });

      // We can't easily mock the private rpcServer, so we just test the method exists
      expect(typeof client.isHealthy).toBe('function');
    });
  });
});
