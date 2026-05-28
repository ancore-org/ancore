export type TransactionType = 'payment' | 'swap' | 'transfer';
export type TransactionStatus = 'completed' | 'pending' | 'failed';
export type TransactionSortKey = 'occurredAt' | 'amount' | 'type' | 'status';
export type TransactionSortDirection = 'asc' | 'desc';
export type TransactionDateFilter = 'all' | '7d' | '30d' | '90d';

export interface Transaction {
  id: string;
  occurredAt: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  counterparty: string;
  memo: string;
}

export interface TransactionTableState {
  date: TransactionDateFilter;
  type: TransactionType | 'all';
  status: TransactionStatus | 'all';
  sort: TransactionSortKey;
  direction: TransactionSortDirection;
}
