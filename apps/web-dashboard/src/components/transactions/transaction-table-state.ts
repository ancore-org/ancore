import type {
  Transaction,
  TransactionDateFilter,
  TransactionSortDirection,
  TransactionSortKey,
  TransactionStatus,
  TransactionTableState,
  TransactionType,
} from './transaction-types';

export const DEFAULT_TRANSACTION_TABLE_STATE: TransactionTableState = {
  date: 'all',
  type: 'all',
  status: 'all',
  sort: 'occurredAt',
  direction: 'desc',
};

const DATE_FILTER_DAYS: Record<Exclude<TransactionDateFilter, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const DATE_FILTERS = new Set<TransactionDateFilter>(['all', '7d', '30d', '90d']);
const TYPE_FILTERS = new Set<TransactionType | 'all'>(['all', 'payment', 'swap', 'transfer']);
const STATUS_FILTERS = new Set<TransactionStatus | 'all'>([
  'all',
  'completed',
  'pending',
  'failed',
]);
const SORT_KEYS = new Set<TransactionSortKey>(['occurredAt', 'amount', 'type', 'status']);
const SORT_DIRECTIONS = new Set<TransactionSortDirection>(['asc', 'desc']);

function isTransactionDateFilter(value: string | null): value is TransactionDateFilter {
  return value !== null && DATE_FILTERS.has(value as TransactionDateFilter);
}

function isTransactionTypeFilter(value: string | null): value is TransactionType | 'all' {
  return value !== null && TYPE_FILTERS.has(value as TransactionType | 'all');
}

function isTransactionStatusFilter(value: string | null): value is TransactionStatus | 'all' {
  return value !== null && STATUS_FILTERS.has(value as TransactionStatus | 'all');
}

function isTransactionSortKey(value: string | null): value is TransactionSortKey {
  return value !== null && SORT_KEYS.has(value as TransactionSortKey);
}

function isTransactionSortDirection(value: string | null): value is TransactionSortDirection {
  return value !== null && SORT_DIRECTIONS.has(value as TransactionSortDirection);
}

export function parseTransactionTableState(
  searchParams: globalThis.URLSearchParams
): TransactionTableState {
  const date = searchParams.get('date');
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const sort = searchParams.get('sort');
  const direction = searchParams.get('direction');

  return {
    date: isTransactionDateFilter(date) ? date : DEFAULT_TRANSACTION_TABLE_STATE.date,
    type: isTransactionTypeFilter(type) ? type : DEFAULT_TRANSACTION_TABLE_STATE.type,
    status: isTransactionStatusFilter(status) ? status : DEFAULT_TRANSACTION_TABLE_STATE.status,
    sort: isTransactionSortKey(sort) ? sort : DEFAULT_TRANSACTION_TABLE_STATE.sort,
    direction: isTransactionSortDirection(direction)
      ? direction
      : DEFAULT_TRANSACTION_TABLE_STATE.direction,
  };
}

export function buildTransactionTableSearchParams(
  state: TransactionTableState
): globalThis.URLSearchParams {
  const params = new globalThis.URLSearchParams();

  if (state.date !== DEFAULT_TRANSACTION_TABLE_STATE.date) {
    params.set('date', state.date);
  }
  if (state.type !== DEFAULT_TRANSACTION_TABLE_STATE.type) {
    params.set('type', state.type);
  }
  if (state.status !== DEFAULT_TRANSACTION_TABLE_STATE.status) {
    params.set('status', state.status);
  }
  if (state.sort !== DEFAULT_TRANSACTION_TABLE_STATE.sort) {
    params.set('sort', state.sort);
  }
  if (state.direction !== DEFAULT_TRANSACTION_TABLE_STATE.direction) {
    params.set('direction', state.direction);
  }

  return params;
}

export function filterTransactions(
  transactions: Transaction[],
  state: Pick<TransactionTableState, 'date' | 'type' | 'status'>
): Transaction[] {
  const cutoffTime =
    state.date === 'all' ? null : Date.now() - DATE_FILTER_DAYS[state.date] * 24 * 60 * 60 * 1000;

  return transactions.filter((transaction) => {
    if (cutoffTime !== null && Date.parse(transaction.occurredAt) < cutoffTime) {
      return false;
    }

    if (state.type !== 'all' && transaction.type !== state.type) {
      return false;
    }

    if (state.status !== 'all' && transaction.status !== state.status) {
      return false;
    }

    return true;
  });
}

function compareTransactionValues(
  left: Transaction,
  right: Transaction,
  sort: TransactionSortKey
): number {
  if (sort === 'occurredAt') {
    return Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
  }

  if (sort === 'amount') {
    return left.amount - right.amount;
  }

  return left[sort].localeCompare(right[sort]);
}

export function sortTransactions(
  transactions: Transaction[],
  sort: TransactionSortKey,
  direction: TransactionSortDirection
): Transaction[] {
  return transactions
    .map((transaction, index) => ({ transaction, index }))
    .sort((left, right) => {
      const value = compareTransactionValues(left.transaction, right.transaction, sort);
      if (value !== 0) {
        return direction === 'asc' ? value : -value;
      }

      return left.index - right.index;
    })
    .map(({ transaction }) => transaction);
}
