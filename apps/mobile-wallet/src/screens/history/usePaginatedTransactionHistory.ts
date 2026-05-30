import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type FetchTransactionPageParams,
  type Transaction,
  type TransactionHistoryAdapter,
} from './types';
import { detectErrorKind, type HistoryError } from './errorTypes';

type Options = {
  adapter: TransactionHistoryAdapter;
  pageSize?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
};

type State = {
  items: Transaction[];
  nextCursor: string | null;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: HistoryError | null;
  retryCount: number;
};

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 1000;

const mergeUniqueTransactions = (
  incoming: Transaction[],
  existing: Transaction[]
): Transaction[] => {
  const byId = new Map<string, Transaction>();

  for (const tx of existing) {
    byId.set(tx.id, tx);
  }

  for (const tx of incoming) {
    byId.set(tx.id, tx);
  }

  return [...byId.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
};

export const usePaginatedTransactionHistory = ({
  adapter,
  pageSize = DEFAULT_PAGE_SIZE,
  maxRetries: _maxRetries = DEFAULT_MAX_RETRIES,
  initialBackoffMs: _initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
}: Options) => {
  const [state, setState] = useState<State>({
    items: [],
    nextCursor: null,
    isLoadingInitial: true,
    isLoadingMore: false,
    isRefreshing: false,
    error: null,
    retryCount: 0,
  });

  const requestIdRef = useRef(0);
  const backoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  const fetchPage = useCallback(
    async ({
      mode,
      cursor,
    }: {
      mode: 'initial' | 'loadMore' | 'refresh';
      cursor: string | null;
    }) => {
      const requestId = ++requestIdRef.current;

      setState((prev) => ({
        ...prev,
        isLoadingInitial: mode === 'initial',
        isLoadingMore: mode === 'loadMore',
        isRefreshing: mode === 'refresh',
        error: null,
      }));

      try {
        const params: FetchTransactionPageParams = {
          cursor,
          pageSize,
        };
        const page = await adapter.fetchTransactionPage(params);

        setState((prev) => {
          if (requestId !== requestIdRef.current) {
            return prev;
          }

          const baseItems = mode === 'refresh' ? [] : prev.items;
          return {
            ...prev,
            items: mergeUniqueTransactions(page.transactions, baseItems),
            nextCursor: page.nextCursor,
            isLoadingInitial: false,
            isLoadingMore: false,
            isRefreshing: false,
            error: null,
          };
        });
      } catch (error) {
        setState((prev) => {
          if (requestId !== requestIdRef.current) {
            return prev;
          }

          const historyError = detectErrorKind(error);
          return {
            ...prev,
            isLoadingInitial: false,
            isLoadingMore: false,
            isRefreshing: false,
            error: historyError,
            retryCount: 0,
          };
        });
      }
    },
    [adapter, pageSize]
  );

  useEffect(() => {
    fetchPage({ mode: 'initial', cursor: null });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (
      state.isLoadingInitial ||
      state.isLoadingMore ||
      state.isRefreshing ||
      state.nextCursor === null
    ) {
      return Promise.resolve();
    }

    return fetchPage({ mode: 'loadMore', cursor: state.nextCursor });
  }, [
    fetchPage,
    state.isLoadingInitial,
    state.isLoadingMore,
    state.isRefreshing,
    state.nextCursor,
  ]);

  const refresh = useCallback(() => {
    return fetchPage({ mode: 'refresh', cursor: null });
  }, [fetchPage]);

  const retry = useCallback(() => {
    const mode = state.items.length === 0 ? 'initial' : 'loadMore';
    const cursor = mode === 'initial' ? null : state.nextCursor;

    return fetchPage({ mode, cursor });
  }, [fetchPage, state.items.length, state.nextCursor]);

  // Cleanup backoff timeout on unmount
  useEffect(() => {
    return () => {
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
    };
  }, []);

  return useMemo(
    () => ({
      ...state,
      hasMore: state.nextCursor !== null,
      loadMore,
      refresh,
      retry,
    }),
    [loadMore, refresh, retry, state]
  );
};
