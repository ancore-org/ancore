import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAccountBalance, fetchAccountData, getHorizonUrl } from '../horizon';
import { env } from '../env';

describe('horizon client', () => {
  const mockPublicKey = 'GABC1234567890ACCOUNT';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('fetchAccountBalance', () => {
    it('returns native balance as a number on success (200 OK)', async () => {
      const mockData = {
        id: mockPublicKey,
        account_id: mockPublicKey,
        balances: [
          { asset_type: 'credit_alphanum4', balance: '50.0000000', asset_code: 'USDC' },
          { asset_type: 'native', balance: '125.5000000' },
        ],
        sequence: '100',
        subentry_count: 1,
        last_modified_ledger: 1000,
        last_modified_time: '2026-01-01T00:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const balance = await fetchAccountBalance(mockPublicKey);
      expect(balance).toBe(125.5);
      expect(fetch).toHaveBeenCalledWith(`${env.VITE_HORIZON_URL}/accounts/${mockPublicKey}`);
    });

    it('throws "Account not found" error on 404 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(fetchAccountBalance(mockPublicKey)).rejects.toThrow(
        `Account not found: ${mockPublicKey}`
      );
    });

    it('throws "Horizon error" on non-200 error (e.g. 500)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(fetchAccountBalance(mockPublicKey)).rejects.toThrow(
        'Horizon error: 500 Internal Server Error'
      );
    });

    it('throws when no native balance is found in balances list', async () => {
      const mockData = {
        id: mockPublicKey,
        account_id: mockPublicKey,
        balances: [{ asset_type: 'credit_alphanum4', balance: '50.0000000', asset_code: 'USDC' }],
        sequence: '100',
        subentry_count: 1,
        last_modified_ledger: 1000,
        last_modified_time: '2026-01-01T00:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      await expect(fetchAccountBalance(mockPublicKey)).rejects.toThrow(
        'No native balance found for account'
      );
    });
  });

  describe('fetchAccountData', () => {
    it('returns full HorizonAccountData on success (200 OK)', async () => {
      const mockData = {
        id: mockPublicKey,
        account_id: mockPublicKey,
        balances: [{ asset_type: 'native', balance: '200.00' }],
        sequence: '12345',
        subentry_count: 2,
        home_domain: 'example.com',
        last_modified_ledger: 5000,
        last_modified_time: '2026-01-02T12:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const data = await fetchAccountData(mockPublicKey);
      expect(data).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(`${env.VITE_HORIZON_URL}/accounts/${mockPublicKey}`);
    });

    it('throws "Account not found" error on 404 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(fetchAccountData(mockPublicKey)).rejects.toThrow(
        `Account not found: ${mockPublicKey}`
      );
    });

    it('throws "Horizon error" on non-200 error (e.g. 500)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(fetchAccountData(mockPublicKey)).rejects.toThrow(
        'Horizon error: 500 Internal Server Error'
      );
    });
  });

  describe('getHorizonUrl', () => {
    it('returns configured Horizon URL', () => {
      expect(getHorizonUrl()).toBe(env.VITE_HORIZON_URL);
    });
  });
});
