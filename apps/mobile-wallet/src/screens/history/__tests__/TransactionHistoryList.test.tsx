import { fireEvent, render, screen } from '@testing-library/react';

import { TransactionHistoryList } from '../../../components/TransactionHistoryList';
import type { Transaction } from '../types';

const formatSnapshotTimestamp = () => '5/29/2026, 11:00:00 AM';

const mockTransaction = (overrides?: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  amount: '100.00',
  direction: 'in' as const,
  timestamp: '2026-05-29T10:00:00.000Z',
  asset: 'USDC',
  status: 'completed',
  ...overrides,
});

describe('TransactionHistoryList', () => {
  describe('transaction row rendering', () => {
    it('renders transaction with status icon', () => {
      const transactions = [mockTransaction()];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByText(/Received/)).toBeInTheDocument();
    });

    it('renders all transaction statuses without crashing', () => {
      const statuses = ['pending', 'completed', 'failed', 'success'] as const;
      const transactions = statuses.map((status, i) => mockTransaction({ id: `tx-${i}`, status }));

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      const icons = screen.getAllByRole('img');
      expect(icons).toHaveLength(4);
    });

    it('renders transaction without status gracefully', () => {
      const transactions = [mockTransaction({ status: undefined })];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Transaction status unknown');
    });

    it('renders incoming transaction with correct direction', () => {
      const transactions = [mockTransaction({ direction: 'in' })];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      expect(screen.getByText(/Received/)).toBeInTheDocument();
    });

    it('renders outgoing transaction with correct direction', () => {
      const transactions = [mockTransaction({ direction: 'out' })];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByText(/Sent/)).toBeInTheDocument();
    });

    it('renders amount and asset', () => {
      const transactions = [mockTransaction({ amount: '250.50', asset: 'ETH' })];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByText(/250.50 ETH/)).toBeInTheDocument();
    });

    it('renders transaction without asset', () => {
      const transactions = [mockTransaction({ asset: undefined })];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByText(/100.00/)).toBeInTheDocument();
    });
  });

  describe('snapshot tests', () => {
    it('matches snapshot for completed transaction row', () => {
      const transactions = [mockTransaction({ status: 'completed' })];

      const { container } = render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      expect(container.querySelector('ul')).toMatchSnapshot();
    });

    it('matches snapshot for pending transaction row', () => {
      const transactions = [mockTransaction({ status: 'pending' })];

      const { container } = render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      expect(container.querySelector('ul')).toMatchSnapshot();
    });

    it('matches snapshot for failed transaction row', () => {
      const transactions = [mockTransaction({ status: 'failed' })];

      const { container } = render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      expect(container.querySelector('ul')).toMatchSnapshot();
    });

    it('matches snapshot for multiple transactions with mixed statuses', () => {
      const transactions = [
        mockTransaction({ id: 'tx-1', status: 'completed' }),
        mockTransaction({ id: 'tx-2', status: 'pending' }),
        mockTransaction({ id: 'tx-3', status: 'failed' }),
      ];

      const { container } = render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          formatTimestamp={formatSnapshotTimestamp}
        />
      );

      expect(container.querySelector('ul')).toMatchSnapshot();
    });
  });

  describe('unknown status callback', () => {
    it('calls onUnknownStatus when invalid status is encountered', () => {
      const onUnknownStatus = jest.fn();
      const invalidStatus = 'invalid-status' as any;
      const transactions = [mockTransaction({ status: invalidStatus })];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          onUnknownStatus={onUnknownStatus}
        />
      );

      expect(onUnknownStatus).toHaveBeenCalledWith(invalidStatus);
    });

    it('does not call onUnknownStatus for valid statuses', () => {
      const onUnknownStatus = jest.fn();
      const transactions = [mockTransaction({ status: 'completed' })];

      render(
        <TransactionHistoryList
          transactions={transactions}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
          onUnknownStatus={onUnknownStatus}
        />
      );

      expect(onUnknownStatus).not.toHaveBeenCalled();
    });
  });

  describe('existing functionality', () => {
    it('still renders loading state', () => {
      render(
        <TransactionHistoryList
          transactions={[]}
          isLoadingInitial={true}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByText(/Loading transactions/)).toBeInTheDocument();
    });

    it('still renders error state', () => {
      render(
        <TransactionHistoryList
          transactions={[]}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={{
            kind: 'network',
            message: 'Network error',
          }}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });

    it('still renders empty state', () => {
      render(
        <TransactionHistoryList
          transactions={[]}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={jest.fn()}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByText(/No transactions yet/)).toBeInTheDocument();
    });

    it('shows the refresh indicator while refresh is running', () => {
      const onRefresh = jest.fn();

      render(
        <TransactionHistoryList
          transactions={[mockTransaction()]}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={true}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={onRefresh}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByRole('status')).toHaveTextContent('Refreshing transactions...');

      const pullTarget = screen.getByTestId('pull-to-refresh');
      fireEvent.touchStart(pullTarget, { touches: [{ clientY: 0 }] });
      fireEvent.touchMove(pullTarget, { touches: [{ clientY: 64 }] });
      fireEvent.touchEnd(pullTarget);

      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('calls refresh when the pull gesture crosses the threshold', () => {
      const onRefresh = jest.fn();

      render(
        <TransactionHistoryList
          transactions={[mockTransaction()]}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={onRefresh}
          onLoadMore={jest.fn()}
        />
      );

      const pullTarget = screen.getByTestId('pull-to-refresh');
      fireEvent.touchStart(pullTarget, { touches: [{ clientY: 0 }] });
      fireEvent.touchMove(pullTarget, { touches: [{ clientY: 64 }] });
      expect(screen.getByRole('status')).toHaveTextContent('Release to refresh');

      fireEvent.touchEnd(pullTarget);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('shows an offline banner and disables manual refresh while offline', () => {
      const onRefresh = jest.fn();

      render(
        <TransactionHistoryList
          transactions={[mockTransaction()]}
          isLoadingInitial={false}
          isLoadingMore={false}
          isRefreshing={false}
          isOffline={true}
          hasMore={false}
          error={null}
          onRetry={jest.fn()}
          onRefresh={onRefresh}
          onLoadMore={jest.fn()}
        />
      );

      expect(screen.getByText(/You are offline/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    });
  });
});
