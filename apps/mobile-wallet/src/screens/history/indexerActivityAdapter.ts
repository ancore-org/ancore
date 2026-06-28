/**
 * Indexer-backed TransactionHistoryAdapter implementation.
 *
 * Maps the indexer REST API `/api/v1/accounts/:account_id/activity` endpoint
 * to the TransactionHistoryAdapter interface used by usePaginatedTransactionHistory.
 */

import type {
  FetchTransactionPageParams,
  HistoryPage,
  Transaction,
  TransactionHistoryAdapter,
} from './types';

/**
 * Indexer API response shape for account activity.
 */
type IndexerActivityResponse = {
  data: Array<{
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
  }>;
  pagination: {
    has_next_page: boolean;
    has_previous_page: boolean;
    next_cursor: string | null;
    prev_cursor: string | null;
    count: number;
  };
};

/**
 * Map indexer activity record to Transaction type.
 */
function mapActivityToTransaction(
  activity: IndexerActivityResponse['data'][0],
  accountId: string
): Transaction {
  // Determine direction based on activity type and counterparty
  const direction: 'in' | 'out' =
    activity.activity_type === 'payment' && activity.counterparty !== accountId ? 'in' : 'out';

  return {
    id: activity.id,
    amount: activity.amount ?? '0',
    direction,
    timestamp: activity.created_at,
    asset: activity.asset ?? undefined,
    status: 'completed', // Indexer only stores finalized transactions
  };
}

/**
 * Create an adapter that fetches transaction history from the indexer REST API.
 *
 * @param baseUrl - Base URL of the indexer service (e.g., "http://localhost:3000")
 * @param accountId - Stellar account ID to fetch activity for
 * @returns TransactionHistoryAdapter instance
 *
 * @example
 * ```ts
 * const adapter = createIndexerActivityAdapter(
 *   process.env.EXPO_PUBLIC_INDEXER_URL!,
 *   'GABC123...'
 * );
 *
 * const history = usePaginatedTransactionHistory({ adapter });
 * ```
 */
export function createIndexerActivityAdapter(
  baseUrl: string,
  accountId: string
): TransactionHistoryAdapter {
  return {
    async fetchTransactionPage(params: FetchTransactionPageParams): Promise<HistoryPage> {
      const url = new URL(`/api/v1/accounts/${accountId}/activity`, baseUrl);

      if (params.cursor) {
        url.searchParams.set('cursor_after', params.cursor);
      }

      url.searchParams.set('limit', String(params.pageSize));

      const response = await fetch(url.toString(), {
        signal: params.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Indexer API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const body: IndexerActivityResponse = await response.json();

      return {
        transactions: body.data.map((activity) => mapActivityToTransaction(activity, accountId)),
        nextCursor: body.pagination.next_cursor,
      };
    },
  };
}
