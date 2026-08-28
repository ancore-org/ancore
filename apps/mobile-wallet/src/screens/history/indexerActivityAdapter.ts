/**
 * Indexer-backed TransactionHistoryAdapter implementation.
 *
 * Maps the indexer REST API endpoints for both account activity and contract events
 * to the TransactionHistoryAdapter interface used by usePaginatedTransactionHistory.
 * AA events (session keys, contract execution) are merged into the unified history.
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
 * Indexer API response shape for contract events.
 */
type IndexerContractEvent = {
  id: string;
  contract_address: string;
  account_id: string;
  event_type: string;
  ledger_seq: number;
  timestamp: string;
  tx_hash: string;
  data: Record<string, unknown>;
};

type ContractEventsResponse = {
  data: IndexerContractEvent[];
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
  const direction: 'in' | 'out' =
    activity.activity_type === 'payment' && activity.counterparty !== accountId ? 'in' : 'out';

  return {
    id: activity.id,
    amount: activity.amount ?? '0',
    direction,
    timestamp: activity.created_at,
    asset: activity.asset ?? undefined,
    status: 'completed',
  };
}

/**
 * Map a contract event to a Transaction for unified display.
 */
function mapContractEventToTransaction(event: IndexerContractEvent): Transaction {
  const direction: 'in' | 'out' =
    event.event_type === 'session_key_added' || event.event_type === 'session_key_ttl_refreshed'
      ? 'in'
      : 'out';

  return {
    id: event.id,
    amount: '0',
    direction,
    timestamp: event.timestamp,
    asset: undefined,
    status: 'completed',
  };
}

/**
 * Merge and deduplicate two sorted arrays by timestamp DESC, id tiebreak.
 */
function mergeUniqueTransactions(
  activity: Transaction[],
  contractEvents: Transaction[]
): Transaction[] {
  const merged = [...activity, ...contractEvents];
  const seen = new Set<string>();
  const result: Transaction[] = [];

  for (const tx of merged) {
    if (!seen.has(tx.id)) {
      seen.add(tx.id);
      result.push(tx);
    }
  }

  result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return result;
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
      const activityUrl = new URL(
        `/api/v1/accounts/${encodeURIComponent(accountId)}/activity`,
        baseUrl
      );

      if (params.cursor) {
        activityUrl.searchParams.set('cursor_after', params.cursor);
      }
      activityUrl.searchParams.set('limit', String(params.pageSize));

      const contractEventsUrl = new URL('/api/v1/contract-events', baseUrl);
      contractEventsUrl.searchParams.set('account', accountId);
      contractEventsUrl.searchParams.set('limit', String(params.pageSize));
      if (params.cursor) {
        contractEventsUrl.searchParams.set('cursor_after', params.cursor);
      }

      // The contract-events feed is optional: never let its failure break the
      // page load. An inline `.catch()` is not enough — if `fetch` throws
      // synchronously the array literal never finishes evaluating, so
      // Promise.all is never reached and the activity request's rejection is
      // left unhandled (which crashes the process).
      const fetchContractEvents = async (): Promise<Response | null> => {
        try {
          return await fetch(contractEventsUrl.toString(), {
            signal: params.signal,
            headers: { Accept: 'application/json' },
          });
        } catch {
          return null;
        }
      };

      const [activityResponse, contractEventsResponse] = await Promise.all([
        fetch(activityUrl.toString(), {
          signal: params.signal,
          headers: { Accept: 'application/json' },
        }),
        fetchContractEvents(),
      ]);

      if (!activityResponse.ok) {
        const errorText = await activityResponse.text().catch(() => 'Unknown error');
        throw new Error(
          `Indexer API error: ${activityResponse.status} ${activityResponse.statusText} - ${errorText}`
        );
      }

      const activityBody: IndexerActivityResponse = await activityResponse.json();

      let contractEvents: IndexerContractEvent[] = [];
      if (contractEventsResponse?.ok) {
        const eventsBody: ContractEventsResponse = await contractEventsResponse.json();
        contractEvents = eventsBody.data;
      }

      const activityTransactions = activityBody.data.map((activity) =>
        mapActivityToTransaction(activity, accountId)
      );
      const contractEventTransactions = contractEvents.map(mapContractEventToTransaction);

      const merged = mergeUniqueTransactions(activityTransactions, contractEventTransactions);

      return {
        transactions: merged.slice(0, params.pageSize),
        nextCursor: activityBody.pagination.next_cursor,
      };
    },
  };
}
