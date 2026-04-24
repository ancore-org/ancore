import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TransactionList } from '../TransactionList';
import type { Transaction } from '../../types/dashboard';

vi.mock('@ancore/ui-kit', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

const makeTx = (id: string, type: 'send' | 'receive' = 'send'): Transaction => ({
  id,
  type,
  amount: 10,
  timestamp: new Date('2026-01-01'),
  status: 'confirmed',
  counterparty: 'GXYZ',
});

describe('TransactionList', () => {
  it('renders empty state', () => {
    render(<TransactionList transactions={[]} />);
    expect(screen.getByText('No transactions found.')).toBeInTheDocument();
  });

  it('renders transactions', () => {
    render(<TransactionList transactions={[makeTx('tx1', 'receive'), makeTx('tx2', 'send')]} />);
    expect(screen.getByText('receive')).toBeInTheDocument();
    expect(screen.getByText('send')).toBeInTheDocument();
    expect(screen.getByText('+10 XLM')).toBeInTheDocument();
    expect(screen.getByText('-10 XLM')).toBeInTheDocument();
  });

  it('paginates when transactions exceed pageSize', async () => {
    const txs = Array.from({ length: 7 }, (_, i) => makeTx(`tx${i}`));
    render(<TransactionList transactions={txs} pageSize={5} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Next'));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('disables Previous on first page and Next on last page', async () => {
    const txs = Array.from({ length: 7 }, (_, i) => makeTx(`tx${i}`));
    render(<TransactionList transactions={txs} pageSize={5} />);
    expect(screen.getByText('Previous')).toBeDisabled();
    await userEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Next')).toBeDisabled();
  });
});
