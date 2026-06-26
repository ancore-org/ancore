import { isMemoRequired } from '../memoCheck';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  // Clear module-level cache between tests by reimporting
  vi.resetModules();
});

describe('isMemoRequired', () => {
  it('returns true when API reports require_memo', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ require_memo: true }),
    } as Response);

    const { isMemoRequired: check } = await import('../memoCheck');
    const result = await check('GCEXCHANGE000000000000000000000000000000000000000000000000');
    expect(result).toBe(true);
  });

  it('returns false when require_memo is absent', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { isMemoRequired: check } = await import('../memoCheck');
    const result = await check('GCREGULAR0000000000000000000000000000000000000000000000000');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));

    const { isMemoRequired: check } = await import('../memoCheck');
    const result = await check('GCFAILURE000000000000000000000000000000000000000000000000');
    expect(result).toBe(false);
  });

  it('returns false on non-200 response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);

    const { isMemoRequired: check } = await import('../memoCheck');
    const result = await check('GCNOTFOUND00000000000000000000000000000000000000000000000');
    expect(result).toBe(false);
  });

  it('caches results to avoid duplicate API calls', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ require_memo: true }),
    } as Response);

    const { isMemoRequired: check } = await import('../memoCheck');
    const addr = 'GCEXCHANGE111111111111111111111111111111111111111111111111';
    await check(addr);
    await check(addr);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
