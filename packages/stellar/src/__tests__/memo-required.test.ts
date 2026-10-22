import { checkMemoRequired, clearMemoRequiredCache } from '../memo-required';

const asFetch = (mock: jest.Mock) => mock as unknown as typeof fetch;

describe('checkMemoRequired', () => {
  beforeEach(() => {
    clearMemoRequiredCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns false for empty or non-string address without fetching', async () => {
    const fetchMock = jest.fn();
    expect(await checkMemoRequired('', { fetchFn: asFetch(fetchMock) })).toBe(false);
    expect(await checkMemoRequired('   ', { fetchFn: asFetch(fetchMock) })).toBe(false);
    expect(
      await checkMemoRequired(null as unknown as string, { fetchFn: asFetch(fetchMock) })
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when address has memo-required tag', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        address: 'GBINANCE1234567890',
        name: 'Binance',
        tags: ['exchange', 'memo-required'],
      }),
    });

    const result = await checkMemoRequired('GBINANCE1234567890', {
      fetchFn: asFetch(fetchMock),
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.stellar.expert/explorer/public/directory/GBINANCE1234567890',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns true when address has memo_required: true', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        address: 'GKRAKEN1234567890',
        name: 'Kraken',
        memo_required: true,
      }),
    });

    const result = await checkMemoRequired('GKRAKEN1234567890', {
      fetchFn: asFetch(fetchMock),
    });

    expect(result).toBe(true);
  });

  it('returns false when address does not require a memo', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        address: 'GREGULAR1234567890',
        name: 'Regular Wallet',
        tags: ['wallet'],
      }),
    });

    const result = await checkMemoRequired('GREGULAR1234567890', {
      fetchFn: asFetch(fetchMock),
    });

    expect(result).toBe(false);
  });

  it('returns false on 404 not found in directory', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await checkMemoRequired('GUNKNOWN1234567890', {
      fetchFn: asFetch(fetchMock),
    });

    expect(result).toBe(false);
  });

  it('returns false on network or fetch error', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await checkMemoRequired('GERR1234567890', {
      fetchFn: asFetch(fetchMock),
    });

    expect(result).toBe(false);
  });

  it('caches results within TTL and uses cached value', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        address: 'GCACHE1234567890',
        tags: ['memo-required'],
      }),
    });

    const res1 = await checkMemoRequired('GCACHE1234567890', {
      fetchFn: asFetch(fetchMock),
      cacheTtlMs: 60000,
    });
    expect(res1).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call within TTL -> uses cache
    const res2 = await checkMemoRequired('GCACHE1234567890', {
      fetchFn: asFetch(fetchMock),
      cacheTtlMs: 60000,
    });
    expect(res2).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance time past TTL
    jest.advanceTimersByTime(60001);

    // Third call after TTL -> fetches again
    const res3 = await checkMemoRequired('GCACHE1234567890', {
      fetchFn: asFetch(fetchMock),
      cacheTtlMs: 60000,
    });
    expect(res3).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clearMemoRequiredCache invalidates cached entries', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        address: 'GCLEAR1234567890',
        tags: ['memo-required'],
      }),
    });

    await checkMemoRequired('GCLEAR1234567890', { fetchFn: asFetch(fetchMock) });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearMemoRequiredCache();

    await checkMemoRequired('GCLEAR1234567890', { fetchFn: asFetch(fetchMock) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
