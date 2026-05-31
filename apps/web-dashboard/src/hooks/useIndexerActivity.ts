import { useState, useEffect, useCallback } from 'react';
import type { Transaction } from '../types/dashboard';
import { env } from '../lib/env';

/**
 * Indexer transaction response format (API v1).
 * Production indexer returns ISO timestamps; amounts are strings for precision.
 *
 * VITE_INDEXER_BASE_URL: Base URL for the Ancore indexer service.
 * Used to query transaction history, account state, and contract events.
 * Required. Must be a valid URL (including scheme).
 */
export interface IndexerTransaction {
  id: string;
  type: 'send' | 'receive';
  amount: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
  counterparty: string;
}

/**
 * Indexer pagination response shape.
 * nextCursor is null when no more pages exist.
 */
export interface IndexerPage {
  items: IndexerTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UseIndexerActivityReturn {
  items: Transaction[];
  loading: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

export function useIndexerActivity(accountId: string): UseIndexerActivityReturn {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = useCallback(
    async (cursor: string | null = null) => {
      if (!accountId) return;

      setLoading(true);
      setError(null);

      try {
        const url = new URL(`${env.VITE_INDEXER_BASE_URL}/api/transactions`);
        url.searchParams.set('accountId', accountId);
        if (cursor) {
          url.searchParams.set('cursor', cursor);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(`Failed to fetch transactions: ${response.statusText}`);
        }

        const data: IndexerPage = await response.json();

        const transformedItems: Transaction[] = data.items.map((tx) => ({
          ...tx,
          amount: parseFloat(tx.amount),
          timestamp: new Date(tx.timestamp),
        }));

        if (cursor) {
          setItems((prev) => [...prev, ...transformedItems]);
        } else {
          setItems(transformedItems);
        }

        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch transactions'));
      } finally {
        setLoading(false);
      }
    },
    [accountId]
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, accountId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchTransactions(nextCursor);
  }, [hasMore, loading, nextCursor, fetchTransactions]);

  const refetch = useCallback(async () => {
    setNextCursor(null);
    setHasMore(true);
    await fetchTransactions();
  }, [fetchTransactions]);

  return { items, loading, error, loadMore, hasMore, refetch };
}
