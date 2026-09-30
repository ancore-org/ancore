import {
  AccountAbstractionClient,
  withNetworkRetry,
  isTransientError,
  calculateBackoff,
} from '../index';

describe('AccountAbstractionClient and Network Retry', () => {
  const mockServer = {
    getAccount: jest.fn(),
    simulateTransaction: jest.fn(),
    sendTransaction: jest.fn(),
  };

  const dummyContractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isTransientError helper', () => {
    it('detects network timeout and connection reset errors', () => {
      expect(isTransientError({ code: 'TIMEOUT' })).toBe(true);
      expect(isTransientError({ code: 'ECONNRESET' })).toBe(true);
      expect(isTransientError({ status: 503 })).toBe(true);
      expect(isTransientError(new Error('504 Gateway Timeout'))).toBe(true);
      expect(isTransientError(new Error('Network request failed'))).toBe(true);
    });

    it('rejects client validation and contract logic errors', () => {
      expect(isTransientError({ status: 400 })).toBe(false);
      expect(isTransientError(new Error('Account contract is already initialized'))).toBe(false);
      expect(isTransientError(null)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('calculates exponential backoff correctly', () => {
      expect(calculateBackoff(0, 100, 10000, false)).toBe(100);
      expect(calculateBackoff(1, 100, 10000, false)).toBe(200);
      expect(calculateBackoff(2, 100, 10000, false)).toBe(400);
    });

    it('applies jitter within range', () => {
      const delay = calculateBackoff(1, 1000, 10000, true);
      expect(delay).toBeGreaterThanOrEqual(1800);
      expect(delay).toBeLessThanOrEqual(2200);
    });
  });

  describe('withNetworkRetry wrapper', () => {
    it('retries on transient failure and succeeds', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('read ECONNRESET');
        }
        return 'success';
      };

      const result = await withNetworkRetry(operation, {
        maxRetries: 2,
        baseDelayMs: 10,
        jitter: false,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('throws immediately on non-transient errors', async () => {
      const operation = async () => {
        throw new Error('Unauthorized');
      };

      await expect(
        withNetworkRetry(operation, {
          maxRetries: 3,
          baseDelayMs: 10,
        })
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('AccountAbstractionClient RPC methods', () => {
    it('wraps getAccount with automatic retry', async () => {
      const client = new AccountAbstractionClient({
        contractId: dummyContractId,
        server: mockServer,
        retryOptions: { maxRetries: 2, baseDelayMs: 10, jitter: false },
      });

      mockServer.getAccount
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValueOnce({ id: 'GB...', sequence: '123' });

      const account = await client.getAccount('GB...');
      expect(account).toEqual({ id: 'GB...', sequence: '123' });
      expect(mockServer.getAccount).toHaveBeenCalledTimes(2);
    });

    it('wraps simulateTransaction with automatic retry', async () => {
      const client = new AccountAbstractionClient({
        contractId: dummyContractId,
        server: mockServer,
        retryOptions: { maxRetries: 2, baseDelayMs: 10, jitter: false },
      });

      mockServer.simulateTransaction
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce({ result: { retval: 42 } });

      const res = await client.simulateTransaction({ tx: 'dummy' });
      expect(res).toEqual({ result: { retval: 42 } });
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(2);
    });

    it('wraps sendTransaction with automatic retry', async () => {
      const client = new AccountAbstractionClient({
        contractId: dummyContractId,
        server: mockServer,
        retryOptions: { maxRetries: 2, baseDelayMs: 10, jitter: false },
      });

      mockServer.sendTransaction
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ hash: '0xabc' });

      const res = await client.sendTransaction({ tx: 'dummy' });
      expect(res).toEqual({ hash: '0xabc' });
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(2);
    });
  });
});
