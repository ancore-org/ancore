export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'success';

export type Transaction = {
  id: string;
  amount: string;
  direction: 'in' | 'out';
  timestamp: string;
  asset?: string;
  status?: TransactionStatus;
};

export type HistoryPage = {
  transactions: Transaction[];
  nextCursor: string | null;
};

export type FetchTransactionPageParams = {
  cursor: string | null;
  pageSize: number;
  signal?: AbortSignal;
};

export interface TransactionHistoryAdapter {
  fetchTransactionPage(params: FetchTransactionPageParams): Promise<HistoryPage>;
}
