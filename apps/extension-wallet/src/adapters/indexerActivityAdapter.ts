export type IndexerActivityRecord = {
  id: string;
  account_id: string;
  activity_type: string;
  amount: string | null;
  asset: string | null;
  counterparty: string | null;
  tx_hash: string;
  ledger_seq: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type IndexerActivityResponse = {
  data: IndexerActivityRecord[];
  pagination: {
    has_next_page: boolean;
    next_cursor: string | null;
    count: number;
  };
};

export type TransactionPageParams = {
  cursor: string | null;
  pageSize: number;
  signal?: AbortSignal;
};

export type TransactionPage = {
  transactions: IndexerActivityRecord[];
  nextCursor: string | null;
};

export type TransactionHistoryAdapter = {
  fetchTransactionPage(params: TransactionPageParams): Promise<TransactionPage>;
};

export function createIndexerActivityAdapter(
  baseUrl: string,
  accountId: string
): TransactionHistoryAdapter {
  return {
    async fetchTransactionPage(params): Promise<TransactionPage> {
      const url = new URL(`/api/v1/accounts/${encodeURIComponent(accountId)}/activity`, baseUrl);

      if (params.cursor) {
        url.searchParams.set('cursor_after', params.cursor);
      }

      url.searchParams.set('limit', String(params.pageSize));

      const response = await fetch(url.toString(), {
        signal: params.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Indexer API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const body: IndexerActivityResponse = await response.json();

      return {
        transactions: body.data,
        nextCursor: body.pagination.next_cursor,
      };
    },
  };
}
