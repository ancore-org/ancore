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
    has_previous_page: boolean;
    next_cursor: string | null;
    prev_cursor: string | null;
    count: number;
  };
};

export type IndexerContractEvent = {
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

/**
 * Map a contract event to an IndexerActivityRecord shape for unified display.
 */
function contractEventToActivityRecord(event: IndexerContractEvent): IndexerActivityRecord {
  const labels: Record<string, string> = {
    session_key_added: 'Session key added',
    session_key_revoked: 'Session key revoked',
    session_key_ttl_refreshed: 'Session key renewed',
    executed: 'Contract executed',
    initialized: 'Account initialized',
    upgraded: 'Contract upgraded',
    migrated: 'Contract migrated',
  };

  return {
    id: event.id,
    account_id: event.account_id,
    activity_type: event.event_type,
    amount: null,
    asset: null,
    counterparty: (event.data?.public_key as string | null) ?? null,
    tx_hash: event.tx_hash,
    ledger_seq: event.ledger_seq,
    created_at: event.timestamp,
    metadata: {
      source: 'contract_event',
      label: labels[event.event_type] ?? event.event_type,
      contract_address: event.contract_address,
      ...event.data,
    },
  };
}

/**
 * Merge and deduplicate two sorted arrays by created_at DESC, tx_hash tiebreak.
 */
function mergeAndDedup(
  activity: IndexerActivityRecord[],
  contractEvents: IndexerActivityRecord[]
): IndexerActivityRecord[] {
  const merged = [...activity, ...contractEvents];
  const seen = new Set<string>();
  const result: IndexerActivityRecord[] = [];

  for (const record of merged) {
    const key = `${record.tx_hash}:${record.activity_type}:${record.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(record);
    }
  }

  result.sort((a, b) => {
    const dateCmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateCmp !== 0) return dateCmp;
    return b.tx_hash.localeCompare(a.tx_hash);
  });

  return result;
}

export function createIndexerActivityAdapter(
  baseUrl: string,
  accountId: string
): TransactionHistoryAdapter {
  return {
    async fetchTransactionPage(params): Promise<TransactionPage> {
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

      const [activityResponse, contractEventsResponse] = await Promise.all([
        fetch(activityUrl.toString(), {
          signal: params.signal,
          headers: { Accept: 'application/json' },
        }),
        fetch(contractEventsUrl.toString(), {
          signal: params.signal,
          headers: { Accept: 'application/json' },
        }).catch(() => null),
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

      const activityRecords = activityBody.data;
      const contractEventRecords = contractEvents.map(contractEventToActivityRecord);

      const merged = mergeAndDedup(activityRecords, contractEventRecords);

      return {
        transactions: merged.slice(0, params.pageSize),
        nextCursor: activityBody.pagination.next_cursor,
      };
    },
  };
}
