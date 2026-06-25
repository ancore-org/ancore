import { fetchFeeStats, FALLBACK_FEE_STATS } from '../fee-stats';
import { NetworkError } from '../errors';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

const mockFeeStatsResponse = {
  fee_charged: {
    min: '100',
    mode: '250',
    p90: '1000',
  },
};

describe('fetchFeeStats', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ── Success ────────────────────────────────────────────────────────────────

  it('returns normalized fee stats on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFeeStatsResponse),
    });

    const result = await fetchFeeStats({ horizonUrl: HORIZON_URL });

    expect(result).toEqual({
      minFee: 100,
      modeFee: 250,
      p90Fee: 1000,
      isFallback: false,
    });
    expect(global.fetch).toHaveBeenCalledWith(`${HORIZON_URL}/fee_stats`);
  });

  it('strips trailing slash from horizonUrl', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFeeStatsResponse),
    });

    await fetchFeeStats({ horizonUrl: `${HORIZON_URL}/` });

    expect(global.fetch).toHaveBeenCalledWith(`${HORIZON_URL}/fee_stats`);
  });

  // ── Fallback ───────────────────────────────────────────────────────────────

  it('returns default fallback when fetch throws a network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const result = await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: { maxRetries: 0 },
    });

    expect(result).toEqual({ ...FALLBACK_FEE_STATS, isFallback: true });
  });

  it('returns custom fallback when provided and fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const customFallback = { minFee: 200, modeFee: 300, p90Fee: 500, isFallback: true };

    const result = await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: { maxRetries: 0 },
      fallback: customFallback,
    });

    expect(result).toEqual(customFallback);
  });

  it('returns fallback when Horizon returns a permanent 4xx error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    const result = await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: { maxRetries: 2, baseDelayMs: 0 },
    });

    expect(result.isFallback).toBe(true);
    // 404 is not retryable — should only call fetch once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // ── Retry ──────────────────────────────────────────────────────────────────

  it('retries on 503 and succeeds on the next attempt', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFeeStatsResponse),
      });

    const result = await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: { maxRetries: 2, baseDelayMs: 0 },
    });

    expect(result.isFallback).toBe(false);
    expect(result.modeFee).toBe(250);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 rate-limit and succeeds', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFeeStatsResponse),
      });

    const result = await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: { maxRetries: 2, baseDelayMs: 0 },
    });

    expect(result.isFallback).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on network-level fetch failure and succeeds', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFeeStatsResponse),
      });

    const result = await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: { maxRetries: 2, baseDelayMs: 0 },
    });

    expect(result.isFallback).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back after exhausting all retries on persistent 500 errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const result = await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: { maxRetries: 2, baseDelayMs: 0 },
    });

    expect(result.isFallback).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  // ── Error shape ────────────────────────────────────────────────────────────

  it('wraps fetch rejection as NetworkError before retrying', async () => {
    let caughtError: unknown;

    (global.fetch as jest.Mock).mockRejectedValue(new Error('DNS failure'));

    // Intercept the error by using a custom isRetryable that captures it
    await fetchFeeStats({
      horizonUrl: HORIZON_URL,
      retryOptions: {
        maxRetries: 1,
        baseDelayMs: 0,
        isRetryable: (err) => {
          caughtError = err;
          return false; // stop immediately
        },
      },
    });

    expect(caughtError).toBeInstanceOf(NetworkError);
  });
});
