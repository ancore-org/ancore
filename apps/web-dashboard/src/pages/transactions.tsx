import { TransactionTable } from '../components/transactions/TransactionTable';
import type { Transaction } from '../components/transactions/transaction-types';

const DASHBOARD_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    occurredAt: '2026-04-24T10:00:00.000Z',
    type: 'payment',
    status: 'completed',
    amount: 142.5,
    counterparty: 'Acme Treasury',
    memo: 'Invoice 1042',
  },
  {
    id: 'tx-2',
    occurredAt: '2026-04-24T10:00:00.000Z',
    type: 'swap',
    status: 'completed',
    amount: 142.5,
    counterparty: 'DEX Route',
    memo: 'USDC to XLM',
  },
  {
    id: 'tx-3',
    occurredAt: '2026-04-22T15:30:00.000Z',
    type: 'transfer',
    status: 'pending',
    amount: 85,
    counterparty: 'Client Wallet',
    memo: 'Refund',
  },
  {
    id: 'tx-4',
    occurredAt: '2026-04-18T08:15:00.000Z',
    type: 'payment',
    status: 'failed',
    amount: 12.75,
    counterparty: 'Merchant POS',
    memo: 'Failed charge',
  },
  {
    id: 'tx-5',
    occurredAt: '2026-04-23T18:20:00.000Z',
    type: 'transfer',
    status: 'completed',
    amount: 320,
    counterparty: 'Operations Vault',
    memo: 'Liquidity move',
  },
];

export function TransactionsPage() {
  return <TransactionTable transactions={DASHBOARD_TRANSACTIONS} />;
}
