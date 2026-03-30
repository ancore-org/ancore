import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subDays, set } from 'date-fns';

import { TransactionHistory } from '../components/TransactionHistory';
import { groupTransactionsByDate, formatTransactionAmount } from '../utils/transaction-formatter';

const now = new Date('2026-03-29T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
});

const baseTransactions = [
  {
    id: 'tx-1',
    type: 'received' as const,
    status: 'confirmed' as const,
    from: 'GA1111111111111111111111111111111111111111111111111111111111',
    to: 'GB2222222222222222222222222222222222222222222222222222222222',
    amount: '45.24',
    assetCode: 'XLM',
    timestamp: set(now, { hours: 10, minutes: 30 }),
  },
  {
    id: 'tx-2',
    type: 'sent' as const,
    status: 'pending' as const,
    from: 'GB2222222222222222222222222222222222222222222222222222222222',
    to: 'GC3333333333333333333333333333333333333333333333333333333333',
    amount: '12.5',
    assetCode: 'USDC',
    timestamp: set(subDays(now, 1), { hours: 8, minutes: 15 }),
  },
];

describe('transaction-formatter', () => {
  it('formats amounts with asset code', () => {
    expect(formatTransactionAmount('1234.56', 'XLM')).toBe('1,234.56 XLM');
  });

  it('groups transactions by date', () => {
    const groups = groupTransactionsByDate(baseTransactions);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe('Today');
    expect(groups[1]?.label).toBe('Yesterday');
  });
});

describe('TransactionHistory', () => {
  it('renders grouped transactions', () => {
    render(<TransactionHistory transactions={baseTransactions} />);

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('received')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TransactionHistory transactions={[]} loading />);

    expect(screen.getByLabelText('Loading transactions')).toBeInTheDocument();
  });

  it('shows empty state when no transactions exist', () => {
    render(<TransactionHistory transactions={[]} emptyMessage="Nothing to show" />);

    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  it('calls onTransactionClick when item is clicked', () => {
    const onTransactionClick = vi.fn();

    render(
      <TransactionHistory transactions={baseTransactions} onTransactionClick={onTransactionClick} />
    );

    fireEvent.click(screen.getByRole('button', { name: /received/i }));

    expect(onTransactionClick).toHaveBeenCalledTimes(1);
    expect(onTransactionClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-1' }));
  });
});
