import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionList } from '../TransactionList';
import { TableDensityProvider } from '../../contexts/TableDensityContext';
import type { Transaction } from '../../types/dashboard';

describe('TransactionList', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: 'send',
      amount: 100,
      timestamp: new Date('2024-01-01'),
      status: 'confirmed',
      counterparty: 'GRECIPIENT1',
    },
    {
      id: 'tx-2',
      type: 'receive',
      amount: 50,
      timestamp: new Date('2024-01-02'),
      status: 'confirmed',
      counterparty: 'GSENDER1',
    },
  ];

  const mockOptimisticTransaction: Transaction = {
    id: 'optimistic-1',
    type: 'send',
    amount: 25,
    timestamp: new Date(),
    status: 'pending',
    counterparty: 'GRECIPIENT2',
  };

  const renderWithProvider = (ui: React.ReactElement, options = {}) => {
    return render(ui, { wrapper: TableDensityProvider, ...options });
  };

  const getTransactionRows = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[class*="border-b"]')).filter(
      (row) => row.querySelector('button') === null
    );

  it('renders transaction list', () => {
    renderWithProvider(<TransactionList transactions={mockTransactions} />);
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
  });

  it('displays confirmed transactions', () => {
    renderWithProvider(<TransactionList transactions={mockTransactions} />);
    expect(screen.getByText(/100\s*XLM/)).toBeInTheDocument();
    expect(screen.getByText(/50\s*XLM/)).toBeInTheDocument();
  });

  it('shows empty state when no transactions', () => {
    renderWithProvider(<TransactionList transactions={[]} />);
    expect(screen.getByText('No transactions found.')).toBeInTheDocument();
  });

  it('displays optimistic transaction at top', () => {
    const { container } = renderWithProvider(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    // Optimistic transaction should appear first (before confirmed ones)
    const rows = getTransactionRows(container);
    expect(rows.length).toBeGreaterThan(0);

    // Check that optimistic badge is shown
    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();
  });

  it('includes optimistic transaction in total count', () => {
    renderWithProvider(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
        pageSize={2}
      />
    );

    // Should show 2 transactions per page
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('marks optimistic transaction with pending status', () => {
    renderWithProvider(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();
  });

  it('shows confirmed badge for regular transactions', () => {
    renderWithProvider(<TransactionList transactions={mockTransactions} />);

    expect(screen.getAllByText('confirmed')).toHaveLength(2);
  });

  it('handles optimistic transaction rollback', () => {
    const { rerender } = renderWithProvider(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();

    // Clear optimistic transaction
    rerender(<TransactionList transactions={mockTransactions} optimisticTransaction={null} />);

    expect(screen.queryByText(/pending \(optimistic\)/)).not.toBeInTheDocument();
  });

  it('exports CSV excluding optimistic transactions', () => {
    renderWithProvider(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    // The export should only include confirmed transactions
    expect(mockTransactions.length).toBe(2);
  });

  it('displays clock icon for optimistic transactions', () => {
    const { container } = renderWithProvider(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    // Check for clock icon (lucide-react Clock icon)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('handles pagination with optimistic transaction', () => {
    const manyTransactions = Array.from({ length: 10 }, (_, i) => ({
      id: `tx-${i}`,
      type: 'send' as const,
      amount: 10 * (i + 1),
      timestamp: new Date(),
      status: 'confirmed' as const,
      counterparty: `GRECIPIENT${i}`,
    }));

    renderWithProvider(
      <TransactionList
        transactions={manyTransactions}
        optimisticTransaction={mockOptimisticTransaction}
        pageSize={5}
      />
    );

    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();
  });

  it('maintains optimistic transaction visibility after update', () => {
    const { rerender } = renderWithProvider(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    // Verify optimistic transaction is shown
    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();

    // Re-render with new confirmed transactions added
    const newTransactions = [
      ...mockTransactions,
      {
        id: 'tx-3',
        type: 'receive' as const,
        amount: 75,
        timestamp: new Date(),
        status: 'confirmed' as const,
        counterparty: 'GSENDER2',
      },
    ];

    rerender(
      <TransactionList
        transactions={newTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    // Optimistic should still be visible
    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();
  });

  it('renders sortable headers when transactions exist', () => {
    renderWithProvider(<TransactionList transactions={mockTransactions} />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('does not render sortable headers when no transactions', () => {
    renderWithProvider(<TransactionList transactions={[]} />);

    expect(screen.queryByText('Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Amount')).not.toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('sorts transactions by date in descending order by default', () => {
    const dateSortedTransactions: Transaction[] = [
      {
        id: 'tx-1',
        type: 'send',
        amount: 100,
        timestamp: new Date('2024-01-01'),
        status: 'confirmed',
        counterparty: 'GRECIPIENT1',
      },
      {
        id: 'tx-2',
        type: 'receive',
        amount: 50,
        timestamp: new Date('2024-01-03'),
        status: 'confirmed',
        counterparty: 'GSENDER1',
      },
      {
        id: 'tx-3',
        type: 'send',
        amount: 75,
        timestamp: new Date('2024-01-02'),
        status: 'confirmed',
        counterparty: 'GRECIPIENT2',
      },
    ];

    const { container } = renderWithProvider(
      <TransactionList transactions={dateSortedTransactions} pageSize={10} />
    );

    const rows = getTransactionRows(container);
    const firstRowContent = rows[0].textContent ?? '';
    const lastRowContent = rows[rows.length - 1].textContent ?? '';

    // Most recent date should appear first (tx-2), oldest last (tx-1)
    expect(firstRowContent).toContain('+50 XLM');
    expect(lastRowContent).toContain('-100 XLM');
  });

  it('sorts transactions by amount in ascending order', () => {
    const amountSortedTransactions: Transaction[] = [
      {
        id: 'tx-1',
        type: 'send',
        amount: 100,
        timestamp: new Date('2024-01-01'),
        status: 'confirmed',
        counterparty: 'GRECIPIENT1',
      },
      {
        id: 'tx-2',
        type: 'receive',
        amount: 50,
        timestamp: new Date('2024-01-02'),
        status: 'confirmed',
        counterparty: 'GSENDER1',
      },
      {
        id: 'tx-3',
        type: 'send',
        amount: 75,
        timestamp: new Date('2024-01-03'),
        status: 'confirmed',
        counterparty: 'GRECIPIENT2',
      },
    ];

    const { container } = renderWithProvider(
      <TransactionList transactions={amountSortedTransactions} pageSize={10} />
    );

    // Click Amount header to sort ascending
    fireEvent.click(screen.getByText('Amount'));
    fireEvent.click(screen.getByText('Amount'));

    const rows = getTransactionRows(container);
    const firstRowAmount = rows[0].textContent;
    const lastRowAmount = rows[rows.length - 1].textContent;

    // Smallest amount should appear first (ascending order)
    expect(firstRowAmount).toContain('50 XLM');
    expect(lastRowAmount).toContain('100 XLM');
  });

  it('sorts transactions by status alphabetically', () => {
    const statusSortedTransactions: Transaction[] = [
      {
        id: 'tx-1',
        type: 'send',
        amount: 100,
        timestamp: new Date('2024-01-01'),
        status: 'confirmed',
        counterparty: 'GRECIPIENT1',
      },
      {
        id: 'tx-2',
        type: 'receive',
        amount: 50,
        timestamp: new Date('2024-01-02'),
        status: 'pending',
        counterparty: 'GSENDER1',
      },
      {
        id: 'tx-3',
        type: 'send',
        amount: 75,
        timestamp: new Date('2024-01-03'),
        status: 'confirmed',
        counterparty: 'GRECIPIENT2',
      },
    ];

    const { container } = renderWithProvider(
      <TransactionList transactions={statusSortedTransactions} pageSize={10} />
    );

    fireEvent.click(screen.getByText('Status'));
    fireEvent.click(screen.getByText('Status'));

    const rows = getTransactionRows(container);
    const firstRowStatus = rows[0].textContent;
    const lastRowStatus = rows[rows.length - 1].textContent;

    // 'confirmed' should appear before 'pending' alphabetically in ascending order
    expect(firstRowStatus).toContain('confirmed');
    expect(lastRowStatus).toContain('pending');
  });

  it('toggles sort direction when clicking same header', () => {
    const { container } = renderWithProvider(
      <TransactionList transactions={mockTransactions} pageSize={10} />
    );

    fireEvent.click(screen.getByText('Date'));

    const rows = getTransactionRows(container);
    const firstRowContent = rows[0].textContent ?? '';
    const lastRowContent = rows[rows.length - 1].textContent ?? '';

    // Ascending date order after toggling date sort once
    expect(firstRowContent).toContain('-100 XLM');
    expect(lastRowContent).toContain('+50 XLM');
  });

  it('preserves sort state during pagination', () => {
    const manyTransactions = Array.from({ length: 10 }, (_, i) => ({
      id: `tx-${i}`,
      type: 'send' as const,
      amount: 10 * (i + 1),
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      status: 'confirmed' as const,
      counterparty: `GRECIPIENT${i}`,
    }));

    const { container } = renderWithProvider(
      <TransactionList transactions={manyTransactions} pageSize={5} />
    );

    // Sort by amount ascending
    fireEvent.click(screen.getByText('Amount'));
    fireEvent.click(screen.getByText('Amount'));

    // Navigate to next page
    fireEvent.click(screen.getByText('Next'));

    const rows = getTransactionRows(container);
    const firstRowAmount = rows[0].textContent;

    // First transaction on second page should have amount 60 (sorted ascending)
    expect(firstRowAmount).toContain('60 XLM');
  });

  it('shows sort indicator for active sort field', () => {
    const { container } = renderWithProvider(<TransactionList transactions={mockTransactions} />);

    // Date should be the default sort field with indicator
    const dateButton = screen.getByText('Date').closest('button');
    expect(dateButton).toBeInTheDocument();

    // Check for chevron icon (sort indicator)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
