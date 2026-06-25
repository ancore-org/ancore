import { Horizon } from '@stellar/stellar-sdk';
import { fetchAccountSequence, clearSequenceCache } from '../account-sequence';
import { AccountNotFoundError, NetworkError } from '../errors';

describe('fetchAccountSequence', () => {
  let mockHorizon: Horizon.Server;
  let mockLoadAccount: jest.Mock;

  beforeEach(() => {
    // Clear cache before each test
    clearSequenceCache();

    // Mock Horizon server
    mockLoadAccount = jest.fn();
    mockHorizon = {
      loadAccount: mockLoadAccount,
    } as unknown as Horizon.Server;
  });

  it('fetches account sequence successfully', async () => {
    mockLoadAccount.mockResolvedValue({
      sequence: '1234567890',
      account_id: 'GABC123',
    });

    const result = await fetchAccountSequence(mockHorizon, 'GABC123');

    expect(result.sequence).toBe(BigInt(1234567890));
    expect(result.accountId).toBe('GABC123');
    expect(result.fetchedAt).toBeGreaterThan(0);
    expect(mockLoadAccount).toHaveBeenCalledTimes(1);
  });

  it('throws AccountNotFoundError for unfunded account (404)', async () => {
    const error404 = new Error('Not Found');
    (error404 as Error & { status: number }).status = 404;
    mockLoadAccount.mockRejectedValue(error404);

    await expect(fetchAccountSequence(mockHorizon, 'GUNFUNDED')).rejects.toThrow(
      AccountNotFoundError
    );

    try {
      await fetchAccountSequence(mockHorizon, 'GUNFUNDED');
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AccountNotFoundError);
      if (err instanceof AccountNotFoundError) {
        expect(err.publicKey).toBe('GUNFUNDED');
      }
    }
  });

  it('retries on 429 rate limit errors', async () => {
    let attempts = 0;
    mockLoadAccount.mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        const error429 = new Error('Too Many Requests');
        (error429 as Error & { status: number }).status = 429;
        return Promise.reject(error429);
      }
      return Promise.resolve({
        sequence: '9876543210',
        account_id: 'GABC123',
      });
    });

    const result = await fetchAccountSequence(mockHorizon, 'GABC123', { maxRetries: 3 });

    expect(result.sequence).toBe(BigInt(9876543210));
    expect(attempts).toBe(3);
  });

  it('retries on 5xx server errors', async () => {
    let attempts = 0;
    mockLoadAccount.mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        const error500 = new Error('Internal Server Error');
        (error500 as Error & { status: number }).status = 500;
        return Promise.reject(error500);
      }
      return Promise.resolve({
        sequence: '1111111111',
        account_id: 'GABC123',
      });
    });

    const result = await fetchAccountSequence(mockHorizon, 'GABC123', { maxRetries: 3 });

    expect(result.sequence).toBe(BigInt(1111111111));
    expect(attempts).toBe(2);
  });

  it('does not retry AccountNotFoundError', async () => {
    const error404 = new Error('Not Found');
    (error404 as Error & { status: number }).status = 404;
    mockLoadAccount.mockRejectedValue(error404);

    await expect(fetchAccountSequence(mockHorizon, 'GUNFUNDED', { maxRetries: 5 })).rejects.toThrow(
      AccountNotFoundError
    );

    // Should only attempt once, not retry
    expect(mockLoadAccount).toHaveBeenCalledTimes(1);
  });

  it('uses cache when TTL is valid', async () => {
    mockLoadAccount.mockResolvedValue({
      sequence: '1234567890',
      account_id: 'GABC123',
    });

    // First fetch
    const result1 = await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 1000 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(1);

    // Second fetch should use cache
    const result2 = await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 1000 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(1); // Still only called once
    expect(result2.sequence).toBe(result1.sequence);
  });

  it('bypasses cache when TTL is 0', async () => {
    mockLoadAccount.mockResolvedValue({
      sequence: '1234567890',
      account_id: 'GABC123',
    });

    await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 0 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(1);

    await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 0 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(2); // Called again
  });

  it('expires cache entries after TTL', async () => {
    mockLoadAccount.mockResolvedValue({
      sequence: '1234567890',
      account_id: 'GABC123',
    });

    // First fetch with 10ms TTL
    await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 10 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(1);

    // Wait for cache to expire
    await new Promise((resolve) => setTimeout(resolve, 15));

    // Second fetch should bypass expired cache
    await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 10 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(2);
  });

  it('respects custom maxRetries option', async () => {
    let attempts = 0;
    mockLoadAccount.mockImplementation(() => {
      attempts++;
      const error500 = new Error('Internal Server Error');
      (error500 as Error & { status: number }).status = 500;
      return Promise.reject(error500);
    });

    await expect(fetchAccountSequence(mockHorizon, 'GABC123', { maxRetries: 2 })).rejects.toThrow(
      NetworkError
    );

    // Should attempt maxRetries + 1 = 3 times
    expect(attempts).toBe(3);
  });

  it('handles network errors with retry', async () => {
    let attempts = 0;
    mockLoadAccount.mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        sequence: '2222222222',
        account_id: 'GABC123',
      });
    });

    const result = await fetchAccountSequence(mockHorizon, 'GABC123', { maxRetries: 3 });

    expect(result.sequence).toBe(BigInt(2222222222));
    expect(attempts).toBe(2);
  });

  it('clears cache with clearSequenceCache', async () => {
    mockLoadAccount.mockResolvedValue({
      sequence: '1234567890',
      account_id: 'GABC123',
    });

    await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 1000 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(1);

    clearSequenceCache();

    await fetchAccountSequence(mockHorizon, 'GABC123', { cacheTtlMs: 1000 });
    expect(mockLoadAccount).toHaveBeenCalledTimes(2); // Called again after cache clear
  });

  it('returns result with correct structure', async () => {
    const beforeFetch = Date.now();
    mockLoadAccount.mockResolvedValue({
      sequence: '9999999999',
      account_id: 'GTEST123',
    });

    const result = await fetchAccountSequence(mockHorizon, 'GTEST123');

    expect(result).toHaveProperty('sequence');
    expect(result).toHaveProperty('accountId');
    expect(result).toHaveProperty('fetchedAt');
    expect(typeof result.sequence).toBe('bigint');
    expect(typeof result.accountId).toBe('string');
    expect(typeof result.fetchedAt).toBe('number');
    expect(result.fetchedAt).toBeGreaterThanOrEqual(beforeFetch);
  });

  it('handles different account IDs separately in cache', async () => {
    mockLoadAccount.mockImplementation((accountId: string) => {
      const sequence = accountId === 'GABC1' ? '1111111111' : '2222222222';
      return Promise.resolve({
        sequence,
        account_id: accountId,
      });
    });

    const result1 = await fetchAccountSequence(mockHorizon, 'GABC1', { cacheTtlMs: 1000 });
    const result2 = await fetchAccountSequence(mockHorizon, 'GABC2', { cacheTtlMs: 1000 });

    expect(result1.sequence).toBe(BigInt(1111111111));
    expect(result2.sequence).toBe(BigInt(2222222222));
    expect(mockLoadAccount).toHaveBeenCalledTimes(2); // Both accounts fetched
  });
});
