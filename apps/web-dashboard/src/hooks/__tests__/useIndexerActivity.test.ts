import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useIndexerActivity } from '../useIndexerActivity';

const VALID_ROW = {
  id: 'tx-1',
  type: 'send' as const,
  amount: '100.50',
  timestamp: '2026-07-30T12:00:00.000Z',
  status: 'confirmed' as const,
  counterparty: 'GABCDEF123',
};

const MALFORMED_ROW = {
  id: 'tx-2',
  type: 'receive' as const,
  amount: 'abc',
  timestamp: 'nope',
  status: 'pending' as const,
  counterparty: 'GXYZ789',
};

describe('useIndexerActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('transforms valid rows correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [VALID_ROW],
        nextCursor: null,
        hasMore: false,
      }),
    } as Response);

    const { result } = renderHook(() => useIndexerActivity('GABC123'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].amount).toBe(100.5);
    expect(result.current.items[0].timestamp).toEqual(new Date('2026-07-30T12:00:00.000Z'));
  });

  it('filters out rows with malformed amount and timestamp', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [VALID_ROW, MALFORMED_ROW],
        nextCursor: null,
        hasMore: false,
      }),
    } as Response);

    const { result } = renderHook(() => useIndexerActivity('GABC123'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('tx-1');
  });

  it('handles empty result set', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        nextCursor: null,
        hasMore: false,
      }),
    } as Response);

    const { result } = renderHook(() => useIndexerActivity('GABC123'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });

  it('handles fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useIndexerActivity('GABC123'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Network error');
  });
});
