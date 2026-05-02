export type Transaction = {
  id: string;
  amount: string;
  direction: 'in' | 'out';
  timestamp: string;
  asset?: string;
  status?: 'pending' | 'completed' | 'failed';
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
