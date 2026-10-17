import type { ListRenderItem } from 'react-native';
import { FlatList, RefreshControl, View, Text, ActivityIndicator } from 'react-native';
import { type Transaction } from '../screens/history/types';
import { type HistoryError } from '../screens/history/errorTypes';
import { TransactionStatusIcon } from './TransactionStatusIcon';
import { HistoryError as HistoryErrorComponent } from './HistoryError';

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
  const renderTransaction: ListRenderItem<Transaction> = ({ item: tx }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
      }}
    >
      <TransactionStatusIcon status={tx.status} onUnknownStatus={onUnknownStatus} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 'bold' }}>
          {tx.direction === 'in' ? 'Received' : 'Sent'} {tx.amount}
          {tx.asset ? ` ${tx.asset}` : ''}
        </Text>
        <Text style={{ color: '#64748b' }}>{formatTimestamp(tx.timestamp)}</Text>
      </View>
    </View>
  );

  const renderHeader = () => {
    if (isOffline) {
      return (
        <View
          style={{ padding: 12, backgroundColor: '#fef3c7' }}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Text>
            You are offline. Transaction history will refresh when your connection returns.
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderFooter = () => {
    if (error && transactions.length > 0) {
      return (
        <View style={{ padding: 16 }}>
          <HistoryErrorComponent
            kind={error.kind}
            message={error.message}
            statusCode={error.statusCode}
            onRetry={onRetry}
            isRetrying={isRefreshing}
          />
        </View>
      );
    }

    if (isLoadingMore) {
      return (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" />
          <Text style={{ marginTop: 8 }}>Loading more...</Text>
        </View>
      );
    }

    if (hasMore && !error) {
      return (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text
            style={{ color: '#3b82f6', textDecorationLine: 'underline' }}
            onPress={onLoadMore}
            accessibilityRole="button"
          >
            Load more
          </Text>
        </View>
      );
    }

    if (transactions.length > 0) {
      return (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ color: '#64748b' }}>End of transaction history</Text>
        </View>
      );
    }

    return null;
  };

  const renderEmpty = () => {
    if (isLoadingInitial) {
      return (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 16 }} accessibilityLiveRegion="polite">
            Loading transactions...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={{ padding: 16 }}>
          <HistoryErrorComponent
            kind={error.kind}
            message={error.message}
            statusCode={error.statusCode}
            onRetry={onRetry}
            isRetrying={isRefreshing}
          />
        </View>
      );
    }

    return (
      <View style={{ padding: 32, alignItems: 'center' }}>
        {isOffline ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert">
            You are offline. Transaction history will refresh when your connection returns.
          </Text>
        ) : null}
        <Text style={{ marginVertical: 16 }}>No transactions yet.</Text>
      </View>
    );
  };

  return (
    <FlatList
      data={transactions}
      renderItem={renderTransaction}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          enabled={!isOffline}
        />
      }
      onEndReached={() => {
        if (hasMore && !isLoadingMore && !error) {
          onLoadMore();
        }
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={transactions.length === 0 ? { flexGrow: 1 } : undefined}
    />
  );
};
