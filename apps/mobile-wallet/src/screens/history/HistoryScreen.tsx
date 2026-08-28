import { TransactionHistoryList } from '../../components/TransactionHistoryList';
import { HistoryError } from '../../components/HistoryError';
import { type TransactionHistoryAdapter } from './types';
import { usePaginatedTransactionHistory } from './usePaginatedTransactionHistory';

type Props = {
  adapter: TransactionHistoryAdapter;
  pageSize?: number;
  isConfigured?: boolean;
  isOnline?: boolean;
};

export const HistoryScreen = ({ adapter, pageSize, isConfigured = true, isOnline }: Props) => {
  const history = usePaginatedTransactionHistory({ adapter, pageSize, isOnline });

  // Show configuration error if adapter not configured
  if (!isConfigured && history.isLoadingInitial) {
    return (
      <HistoryError
        kind="configuration"
        message="INDEXER_URL is not configured"
        onRetry={history.retry}
        isRetrying={history.isRefreshing}
      />
    );
  }

  return (
    <TransactionHistoryList
      transactions={history.items}
      isLoadingInitial={history.isLoadingInitial}
      isLoadingMore={history.isLoadingMore}
      isRefreshing={history.isRefreshing}
      isOffline={history.isOffline}
      hasMore={history.hasMore}
      error={history.error}
      onRetry={history.retry}
      onRefresh={history.refresh}
      onLoadMore={history.loadMore}
    />
  );
};
