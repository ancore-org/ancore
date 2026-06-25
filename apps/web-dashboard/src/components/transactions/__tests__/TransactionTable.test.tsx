import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { TransactionTable } from '../TransactionTable';
import { filterTransactions, sortTransactions } from '../transaction-table-state';
import type { Transaction } from '../transaction-types';

const daysAgo = (days: number): string => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString();
};

const transactions: Transaction[] = [
  {
    id: 'tx-1',
    occurredAt: daysAgo(10),
    type: 'payment',
    status: 'completed',
    amount: 142.5,
    counterparty: 'Acme Treasury',
    memo: 'Invoice 1042',
    merchant: { name: 'Acme Treasury', verificationStatus: 'verified' },
  },
  {
    id: 'tx-2',
    occurredAt: daysAgo(10),
    type: 'swap',
    status: 'completed',
    amount: 142.5,
    counterparty: 'DEX Route',
    memo: 'USDC to XLM',
  },
  {
    id: 'tx-3',
    occurredAt: daysAgo(25),
    type: 'transfer',
    status: 'pending',
    amount: 85,
    counterparty: 'Client Wallet',
    memo: 'Refund',
  },
  {
    id: 'tx-4',
    occurredAt: daysAgo(50),
    type: 'payment',
    status: 'failed',
    amount: 12.75,
    counterparty: 'Merchant POS',
    memo: 'Failed charge',
  },
];

beforeEach(() => {
  window.history.pushState({}, '', '/dashboard/transactions');
});

describe('transaction table helpers', () => {
  it('composes date, type, and status filters together', () => {
    const filtered = filterTransactions(transactions, {
      date: '30d',
      type: 'payment',
      status: 'completed',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('tx-1');
  });

  it('keeps tied rows in their original order when sorting', () => {
    const sorted = sortTransactions(transactions, 'amount', 'asc');

    const tiedRows = sorted.filter((transaction) => transaction.amount === 142.5);
    expect(tiedRows.map((transaction) => transaction.id)).toEqual(['tx-1', 'tx-2']);
  });
});

describe('TransactionTable', () => {
  it('persists filter state in the URL', async () => {
    render(
      <BrowserRouter>
        <TransactionTable transactions={transactions} />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/date filter/i), { target: { value: '30d' } });
    fireEvent.change(screen.getByLabelText(/type filter/i), { target: { value: 'payment' } });
    fireEvent.change(screen.getByLabelText(/status filter/i), {
      target: { value: 'completed' },
    });

    expect(window.location.search).toContain('date=30d');
    expect(window.location.search).toContain('type=payment');
    expect(window.location.search).toContain('status=completed');
  });

  it('shows merchant badge chips in the transaction list', () => {
    render(
      <BrowserRouter>
        <TransactionTable transactions={transactions} />
      </BrowserRouter>
    );

    expect(
      screen.getByRole('status', { name: 'Acme Treasury merchant verification: Verified' })
    ).toBeInTheDocument();
  });

  it('renders only the rows that match the active filters', async () => {
    render(
      <BrowserRouter>
        <TransactionTable transactions={transactions} />
      </BrowserRouter>
    );

    const table = screen.getByRole('table');
    expect(within(table).getByText('Invoice 1042')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/status filter/i), {
      target: { value: 'pending' },
    });

    expect(within(table).getByText('Refund')).toBeInTheDocument();
    expect(within(table).queryByText('Invoice 1042')).not.toBeInTheDocument();
  });
});
