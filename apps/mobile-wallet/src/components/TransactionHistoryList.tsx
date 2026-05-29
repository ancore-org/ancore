import { type Transaction } from '../screens/history/types';
import { type HistoryError } from '../screens/history/errorTypes';
import { TransactionStatusIcon } from './TransactionStatusIcon';
import { HistoryError as HistoryErrorComponent } from './HistoryError';

type Props = {
  transactions: Transaction[];
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  error: HistoryError | null;
  onRetry: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onUnknownStatus?: (status: unknown) => void;
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
  onUnknownStatus,
}: Props) => {
  if (isLoadingInitial) {
    return <p aria-live="polite">Loading transactions…</p>;
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
              {tx.asset ? ` ${tx.asset}` : ''} · {new Date(tx.timestamp).toLocaleString('en-US')}
            </div>
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
