import { type Transaction } from '../screens/history/types';
import { type HistoryError } from '../screens/history/errorTypes';
import { TransactionStatusIcon } from './TransactionStatusIcon';
import { HistoryError as HistoryErrorComponent } from './HistoryError';
import { PullToRefreshControl } from './PullToRefreshControl';

type Props = {
  transactions: Transaction[];
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  isOffline?: boolean;
  hasMore: boolean;
  error: HistoryError | null;
  onRetry: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onUnknownStatus?: (status: unknown) => void;
  formatTimestamp?: (timestamp: string) => string;
};

const defaultFormatTimestamp = (timestamp: string): string =>
  new Date(timestamp).toLocaleString('en-US');

export const TransactionHistoryList = ({
  transactions,
  isLoadingInitial,
  isLoadingMore,
  isRefreshing,
  isOffline = false,
  hasMore,
  error,
  onRetry,
  onRefresh,
  onLoadMore,
  onUnknownStatus,
  formatTimestamp = defaultFormatTimestamp,
}: Props) => {
  if (isLoadingInitial) {
    return <p aria-live="polite">Loading transactions...</p>;
  }

  if (error && transactions.length === 0) {
    return (
      <HistoryErrorComponent
        kind={error.kind}
        message={error.message}
        statusCode={error.statusCode}
        onRetry={onRetry}
        isRetrying={isRefreshing}
      />
    );
  }

  if (transactions.length === 0) {
    return (
      <PullToRefreshControl isRefreshing={isRefreshing} onRefresh={onRefresh}>
        {isOffline ? (
          <p aria-live="polite" role="status">
            You are offline. Transaction history will refresh when your connection returns.
          </p>
        ) : null}
        <p>No transactions yet.</p>
        <button onClick={onRefresh} disabled={isRefreshing || isOffline}>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </PullToRefreshControl>
    );
  }

  return (
    <PullToRefreshControl isRefreshing={isRefreshing} onRefresh={onRefresh}>
      {isOffline ? (
        <p aria-live="polite" role="status">
          You are offline. Transaction history will refresh when your connection returns.
        </p>
      ) : null}

      <button onClick={onRefresh} disabled={isRefreshing || isOffline}>
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>

      {error ? (
        <HistoryErrorComponent
          kind={error.kind}
          message={error.message}
          statusCode={error.statusCode}
          onRetry={onRetry}
          isRetrying={isRefreshing}
        />
      ) : null}

      <ul aria-label="Transaction history">
        {transactions.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 py-3 border-b border-slate-200">
            <TransactionStatusIcon status={tx.status} onUnknownStatus={onUnknownStatus} />
            <div className="flex-1">
              <strong>{tx.direction === 'in' ? 'Received' : 'Sent'}</strong> {tx.amount}
              {tx.asset ? ` ${tx.asset}` : ''} &middot; {formatTimestamp(tx.timestamp)}
            </div>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <button onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? 'Loading more...' : 'Load more'}
        </button>
      ) : (
        <p>End of transaction history</p>
      )}
    </PullToRefreshControl>
  );
};
