import { FlatList, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
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
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText} accessibilityLiveRegion="polite">
          Loading transactions...
        </Text>
      </View>
    );
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
        <View style={styles.emptyContainer}>
          {isOffline ? (
            <Text
              style={styles.offlineText}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              You are offline. Transaction history will refresh when your connection returns.
            </Text>
          ) : null}
          <Text style={styles.emptyText}>No transactions yet.</Text>
          <Pressable
            onPress={onRefresh}
            disabled={isRefreshing || isOffline}
            style={[styles.button, (isRefreshing || isOffline) && styles.buttonDisabled]}
          >
            {({ pressed }) => (
              <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Text>
            )}
          </Pressable>
        </View>
      </PullToRefreshControl>
    );
  }

  const renderItem = ({ item: tx }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <TransactionStatusIcon status={tx.status} onUnknownStatus={onUnknownStatus} />
      <View style={styles.transactionContent}>
        <Text style={styles.transactionText}>
          <Text style={styles.transactionLabel}>{tx.direction === 'in' ? 'Received' : 'Sent'}</Text>{' '}
          {tx.amount}
          {tx.asset ? ` ${tx.asset}` : ''} · {formatTimestamp(tx.timestamp)}
        </Text>
      </View>
    </View>
  );

  const ListHeaderComponent = () => (
    <>
      {isOffline ? (
        <Text style={styles.offlineText} accessibilityLiveRegion="polite" accessibilityRole="alert">
          You are offline. Transaction history will refresh when your connection returns.
        </Text>
      ) : null}

      <Pressable
        onPress={onRefresh}
        disabled={isRefreshing || isOffline}
        style={[
          styles.button,
          styles.refreshButton,
          (isRefreshing || isOffline) && styles.buttonDisabled,
        ]}
      >
        {({ pressed }) => (
          <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        )}
      </Pressable>

      {error ? (
        <HistoryErrorComponent
          kind={error.kind}
          message={error.message}
          statusCode={error.statusCode}
          onRetry={onRetry}
          isRetrying={isRefreshing}
        />
      ) : null}
    </>
  );

  const ListFooterComponent = () => (
    <View style={styles.footerContainer}>
      {hasMore ? (
        <Pressable
          onPress={onLoadMore}
          disabled={isLoadingMore}
          style={[styles.button, isLoadingMore && styles.buttonDisabled]}
        >
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>
              {isLoadingMore ? 'Loading more...' : 'Load more'}
            </Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.endText}>End of transaction history</Text>
      )}
    </View>
  );

  return (
    <PullToRefreshControl isRefreshing={isRefreshing} onRefresh={onRefresh}>
      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        accessibilityLabel="Transaction history"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </PullToRefreshControl>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 20,
    gap: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  offlineText: {
    fontSize: 14,
    color: '#f59e0b',
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
  },
  listContent: {
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionText: {
    fontSize: 14,
    color: '#334155',
  },
  transactionLabel: {
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  refreshButton: {
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  footerContainer: {
    paddingTop: 16,
    alignItems: 'center',
  },
  endText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
