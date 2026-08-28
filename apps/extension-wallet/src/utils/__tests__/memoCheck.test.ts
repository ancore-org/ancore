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

  it('returns false when require_memo is explicitly false', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ require_memo: false }),
    } as Response);

    const { isMemoRequired: check } = await import('../memoCheck');
    const result = await check('GCEXPLICIT0000000000000000000000000000000000000000000000');
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

  describe('table tests for known exchange patterns', () => {
    const testCases = [
      {
        name: 'Binance',
        address: 'GDLNRRPLJZVQGMX7X5ELI7JHIJXBFMSWEWVFFCLUEK5D5VTH7HXTL2K7',
        requireMemo: true,
      },
      {
        name: 'Kraken',
        address: 'GB6YM7TYKXBYD6RJ4LWSTSDNXUKEC7ICJ7K5J4FIVGW5W5S5Q4RJLJLJ',
        requireMemo: true,
      },
      {
        name: 'Coinbase',
        address: 'GDQL5J7T7K7I5J7K7I5J7K7I5J7K7I5J7K7I5J7K7I5J7K7I5J7K7I5J7',
        requireMemo: true,
      },
      {
        name: 'Regular wallet',
        address: 'GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD',
        requireMemo: false,
      },
      {
        name: 'Unknown address',
        address: 'GCUNKNOWN00000000000000000000000000000000000000000000000',
        requireMemo: false,
      },
    ] as const;

    testCases.forEach(({ name, address, requireMemo }) => {
      it(`handles ${name} pattern (${requireMemo ? 'requires' : 'does not require'} memo)`, async () => {
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ require_memo: requireMemo }),
        } as Response);

        const { isMemoRequired: check } = await import('../memoCheck');
        const result = await check(address);
        expect(result).toBe(requireMemo);
      });
    });
  });
});
