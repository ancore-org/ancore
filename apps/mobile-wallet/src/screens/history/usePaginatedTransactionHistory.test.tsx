import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { usePaginatedTransactionHistory } from './usePaginatedTransactionHistory';
import type { HistoryPage, TransactionHistoryAdapter } from './types';

const tx = (id: string, timestamp: string) => ({
  id,
  amount: '10',
  direction: 'in' as const,
  timestamp,
});

describe('usePaginatedTransactionHistory', () => {
  it('uses returned cursor to paginate to the next page', async () => {
    const adapter: TransactionHistoryAdapter = {
      fetchTransactionPage: vi
        .fn()
        .mockResolvedValueOnce({
          transactions: [tx('a', '2026-01-02T00:00:00.000Z')],
          nextCursor: 'cursor-2',
        })
        .mockResolvedValueOnce({
          transactions: [tx('b', '2026-01-01T00:00:00.000Z')],
          nextCursor: null,
        }),
    };

    const { result } = renderHook(() => usePaginatedTransactionHistory({ adapter, pageSize: 1 }));

    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));
    expect(adapter.fetchTransactionPage).toHaveBeenNthCalledWith(1, { cursor: null, pageSize: 1 });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(adapter.fetchTransactionPage).toHaveBeenNthCalledWith(2, {
      cursor: 'cursor-2',
      pageSize: 1,
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(false);
  });

  it('refreshes from the beginning cursor and replaces stale entries', async () => {
    const adapter: TransactionHistoryAdapter = {
      fetchTransactionPage: vi
        .fn()
        .mockResolvedValueOnce({
          transactions: [tx('old', '2026-01-01T00:00:00.000Z')],
          nextCursor: 'cursor-2',
        })
        .mockResolvedValueOnce({
          transactions: [tx('new', '2026-01-03T00:00:00.000Z')],
          nextCursor: null,
        }),
    };

    const { result } = renderHook(() => usePaginatedTransactionHistory({ adapter }));

    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(adapter.fetchTransactionPage).toHaveBeenNthCalledWith(2, {
      cursor: null,
      pageSize: 20,
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['new']);
  });

  it('skips refresh fetches while offline', async () => {
    const adapter: TransactionHistoryAdapter = {
      fetchTransactionPage: vi.fn().mockResolvedValue({
        transactions: [tx('a', '2026-01-01T00:00:00.000Z')],
        nextCursor: null,
      }),
    };

    const { result } = renderHook(() =>
      usePaginatedTransactionHistory({ adapter, isOnline: false })
    );

    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isOffline).toBe(true);
    expect(adapter.fetchTransactionPage).not.toHaveBeenCalled();
  });

  it('resets pagination when refresh completes while a page fetch is in flight', async () => {
    let resolveLoadMore: ((page: HistoryPage) => void) | undefined;

    const adapter: TransactionHistoryAdapter = {
      fetchTransactionPage: vi
        .fn()
        .mockResolvedValueOnce({
          transactions: [tx('a', '2026-01-03T00:00:00.000Z')],
          nextCursor: 'cursor-2',
        })
        .mockImplementationOnce(
          () =>
            new Promise<HistoryPage>((resolve) => {
              resolveLoadMore = resolve;
            })
        )
        .mockResolvedValueOnce({
          transactions: [
            tx('a', '2026-01-03T00:00:00.000Z'),
            tx('fresh', '2026-01-04T00:00:00.000Z'),
          ],
          nextCursor: 'cursor-refresh',
        }),
    };

    const { result } = renderHook(() => usePaginatedTransactionHistory({ adapter }));

    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    void act(() => {
      void result.current.loadMore();
    });

    await waitFor(() => expect(adapter.fetchTransactionPage).toHaveBeenCalledTimes(2));

    await act(async () => {
      await result.current.refresh();
    });

    await act(async () => {
      resolveLoadMore?.({
        transactions: [
          tx('a', '2026-01-03T00:00:00.000Z'),
          tx('stale-page', '2026-01-02T00:00:00.000Z'),
        ],
        nextCursor: null,
      });
    });

    expect(adapter.fetchTransactionPage).toHaveBeenNthCalledWith(2, {
      cursor: 'cursor-2',
      pageSize: 20,
    });
    expect(adapter.fetchTransactionPage).toHaveBeenNthCalledWith(3, {
      cursor: null,
      pageSize: 20,
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['fresh', 'a']);
    expect(result.current.hasMore).toBe(true);
  });

  it('suppresses duplicate transactions when paginating', async () => {
    const adapter: TransactionHistoryAdapter = {
      fetchTransactionPage: vi
        .fn()
        .mockResolvedValueOnce({
          transactions: [
            tx('shared', '2026-01-02T00:00:00.000Z'),
            tx('a', '2026-01-01T00:00:00.000Z'),
          ],
          nextCursor: 'cursor-2',
        })
        .mockResolvedValueOnce({
          transactions: [
            tx('shared', '2026-01-02T00:00:00.000Z'),
            tx('b', '2025-12-31T00:00:00.000Z'),
          ],
          nextCursor: null,
        }),
    };

    const { result } = renderHook(() => usePaginatedTransactionHistory({ adapter }));

    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items.map((item) => item.id)).toEqual(['shared', 'a', 'b']);
  });
});
