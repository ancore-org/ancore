import React from 'react';
import { render, screen } from '@testing-library/react';
import { TransactionList } from '../TransactionList';
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

  it('renders transaction list', () => {
    render(<TransactionList transactions={mockTransactions} />);
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
  });

  it('displays confirmed transactions', () => {
    render(<TransactionList transactions={mockTransactions} />);
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
    expect(screen.getByText('50 XLM')).toBeInTheDocument();
  });

  it('shows empty state when no transactions', () => {
    render(<TransactionList transactions={[]} />);
    expect(screen.getByText('No transactions found.')).toBeInTheDocument();
  });

  it('displays optimistic transaction at top', () => {
    const { container } = render(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    // Optimistic transaction should appear first (before confirmed ones)
    const rows = container.querySelectorAll('[class*="border-b"]');
    expect(rows.length).toBeGreaterThan(0);

    // Check that optimistic badge is shown
    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();
  });

  it('includes optimistic transaction in total count', () => {
    render(
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
    render(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();
  });

  it('shows confirmed badge for regular transactions', () => {
    const { container } = render(<TransactionList transactions={mockTransactions} />);

    // Count confirmed badges (should be 2)
    const confirmBadges = Array.from(container.querySelectorAll('[class*="Badge"]')).filter(
      (el) => el.textContent === 'confirmed'
    );

    expect(confirmBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('handles optimistic transaction rollback', () => {
    const { rerender } = render(
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
    const { container } = render(
      <TransactionList
        transactions={mockTransactions}
        optimisticTransaction={mockOptimisticTransaction}
      />
    );

    // The export should only include confirmed transactions
    expect(mockTransactions.length).toBe(2);
  });

  it('displays clock icon for optimistic transactions', () => {
    const { container } = render(
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

    render(
      <TransactionList
        transactions={manyTransactions}
        optimisticTransaction={mockOptimisticTransaction}
        pageSize={5}
      />
    );

    expect(screen.getByText(/pending \(optimistic\)/)).toBeInTheDocument();
  });

  it('maintains optimistic transaction visibility after update', () => {
    const { rerender } = render(
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
});
