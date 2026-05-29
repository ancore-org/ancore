export type TransactionType = 'payment' | 'swap' | 'transfer';
export type TransactionStatus = 'completed' | 'pending' | 'failed';
export type TransactionSortKey = 'occurredAt' | 'amount' | 'type' | 'status';
export type TransactionSortDirection = 'asc' | 'desc';
export type TransactionDateFilter = 'all' | '7d' | '30d' | '90d';

export interface MerchantSummary {
  name: string;
  verificationStatus: 'verified' | 'pending' | 'unverified' | 'unknown';
}

export interface Transaction {
  id: string;
  occurredAt: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  counterparty: string;
  memo: string;
  merchant?: MerchantSummary | null;
}

export interface TransactionTableState {
  date: TransactionDateFilter;
  type: TransactionType | 'all';
  status: TransactionStatus | 'all';
  sort: TransactionSortKey;
  direction: TransactionSortDirection;
}
