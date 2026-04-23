import React from 'react';

import { type Transaction } from '../screens/history/types';

type Props = {
  transactions: Transaction[];
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
};

export const TransactionHistoryList = ({
  transactions,
  isLoadingInitial,
  isLoadingMore,
  isRefreshing,
  hasMore,
  error,
  onRetry,
  onRefresh,
  onLoadMore,
}: Props) => {
  if (isLoadingInitial) {
    return <p aria-live="polite">Loading transactions…</p>;
  }

  if (error && transactions.length === 0) {
    return (
      <section>
        <p role="alert">Could not load transaction history: {error}</p>
        <button onClick={onRetry}>Retry</button>
      </section>
    );
  }

  if (transactions.length === 0) {
    return (
      <section>
        <p>No transactions yet.</p>
        <button onClick={onRefresh}>Refresh</button>
      </section>
    );
  }

  return (
    <section>
      <button onClick={onRefresh} disabled={isRefreshing}>
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </button>

      {error ? (
        <div>
          <p role="alert">{error}</p>
          <button onClick={onRetry}>Retry</button>
        </div>
      ) : null}

      <ul aria-label="Transaction history">
        {transactions.map((tx) => (
          <li key={tx.id}>
            <strong>{tx.direction === 'in' ? 'Received' : 'Sent'}</strong> {tx.amount}
            {tx.asset ? ` ${tx.asset}` : ''} · {new Date(tx.timestamp).toLocaleString('en-US')}
          </li>
        ))}
      </ul>

      {hasMore ? (
        <button onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? 'Loading more…' : 'Load more'}
        </button>
      ) : (
        <p>End of transaction history</p>
      )}
    </section>
  );
};
