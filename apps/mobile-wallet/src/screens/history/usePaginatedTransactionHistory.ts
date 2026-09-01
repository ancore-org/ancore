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
  isOnline?: boolean;
};

type State = {
  items: Transaction[];
  nextCursor: string | null;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  error: HistoryError | null;
  retryCount: number;
};

type FetchMode = 'initial' | 'loadMore' | 'refresh';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 1000;

const getDefaultOnlineStatus = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

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
  maxRetries = DEFAULT_MAX_RETRIES,
  initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
  isOnline = getDefaultOnlineStatus(),
}: Options) => {
  const [state, setState] = useState<State>({
    items: [],
    nextCursor: null,
    isLoadingInitial: true,
    isLoadingMore: false,
    isRefreshing: false,
    isOffline: !isOnline,
    error: null,
    retryCount: 0,
  });

  const requestIdRef = useRef(0);
  const backoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const retryCountRef = useRef(0);

  const clearScheduledRetry = useCallback(() => {
    if (backoffTimeoutRef.current) {
      clearTimeout(backoffTimeoutRef.current);
      backoffTimeoutRef.current = undefined;
    }
  }, []);

  const fetchPage = useCallback(
    async ({
      mode,
      cursor,
      isAutoRetry = false,
    }: {
      mode: FetchMode;
      cursor: string | null;
      isAutoRetry?: boolean;
    }) => {
      clearScheduledRetry();

      const requestId = ++requestIdRef.current;

      if (!isAutoRetry) {
        retryCountRef.current = 0;
      }

      if (!isOnline) {
        setState((prev) => ({
          ...prev,
          isLoadingInitial: false,
          isLoadingMore: false,
          isRefreshing: false,
          isOffline: true,
          error: null,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoadingInitial: mode === 'initial',
        isLoadingMore: mode === 'loadMore',
        isRefreshing: mode === 'refresh',
        isOffline: false,
        error: null,
        retryCount: retryCountRef.current,
      }));

      try {
        const params: FetchTransactionPageParams = {
          cursor,
          pageSize,
        };
        const page = await adapter.fetchTransactionPage(params);

        if (requestId !== requestIdRef.current) {
          return;
        }

        retryCountRef.current = 0;

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
            isOffline: false,
            error: null,
            retryCount: 0,
          };
        });
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        const historyError = detectErrorKind(error);
        retryCountRef.current += 1;
        const attempt = retryCountRef.current;

        setState((prev) => ({
          ...prev,
          isLoadingInitial: false,
          isLoadingMore: false,
          isRefreshing: false,
          isOffline: false,
          error: historyError,
          retryCount: attempt,
        }));

        if (attempt <= maxRetries) {
          const backoffMs = initialBackoffMs * 2 ** (attempt - 1);
          backoffTimeoutRef.current = setTimeout(() => {
            if (requestId !== requestIdRef.current) {
              return;
            }
            void fetchPage({ mode, cursor, isAutoRetry: true });
          }, backoffMs);
        }
      }
    },
    [adapter, isOnline, pageSize, maxRetries, initialBackoffMs, clearScheduledRetry]
  );

  useEffect(() => {
    void fetchPage({ mode: 'initial', cursor: null });
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

  useEffect(() => {
    return () => {
      clearScheduledRetry();
    };
  }, [clearScheduledRetry]);

  return useMemo(
    () => ({
      ...state,
      hasMore: state.nextCursor !== null,
      maxRetries,
      loadMore,
      refresh,
      retry,
    }),
    [loadMore, refresh, retry, state, maxRetries]
  );
};
