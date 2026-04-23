import React from 'react';

import { TransactionHistoryList } from '../../components/TransactionHistoryList';
import { type TransactionHistoryAdapter } from './types';
import { usePaginatedTransactionHistory } from './usePaginatedTransactionHistory';

type Props = {
  adapter: TransactionHistoryAdapter;
  pageSize?: number;
};

export const HistoryScreen = ({ adapter, pageSize }: Props) => {
  const history = usePaginatedTransactionHistory({ adapter, pageSize });

  return (
    <TransactionHistoryList
      transactions={history.items}
      isLoadingInitial={history.isLoadingInitial}
      isLoadingMore={history.isLoadingMore}
      isRefreshing={history.isRefreshing}
      hasMore={history.hasMore}
      error={history.error}
      onRetry={history.retry}
      onRefresh={history.refresh}
      onLoadMore={history.loadMore}
    />
  );
};
