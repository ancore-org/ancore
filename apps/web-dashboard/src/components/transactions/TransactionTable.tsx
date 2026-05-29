import { useMemo } from 'react';
import { MerchantBadge } from '@ancore/ui-kit';
import { useSearchParams } from 'react-router-dom';

import {
  buildTransactionTableSearchParams,
  filterTransactions,
  parseTransactionTableState,
  sortTransactions,
} from './transaction-table-state';
import type { Transaction, TransactionSortKey, TransactionTableState } from './transaction-types';

interface TransactionTableProps {
  transactions: Transaction[];
  onExportStatement?: () => void;
}

const DATE_FILTER_LABELS: Record<TransactionTableState['date'], string> = {
  all: 'All time',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

const TYPE_FILTER_LABELS: Record<TransactionTableState['type'], string> = {
  all: 'All types',
  payment: 'Payments',
  swap: 'Swaps',
  transfer: 'Transfers',
};

const STATUS_FILTER_LABELS: Record<TransactionTableState['status'], string> = {
  all: 'All statuses',
  completed: 'Completed',
  pending: 'Pending',
  failed: 'Failed',
};

const SORT_LABELS: Record<TransactionSortKey, string> = {
  occurredAt: 'Date',
  amount: 'Amount',
  type: 'Type',
  status: 'Status',
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function TransactionTable({ onExportStatement, transactions }: TransactionTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseTransactionTableState(searchParams), [searchParams]);

  const filteredTransactions = useMemo(() => {
    const filtered = filterTransactions(transactions, state);
    return sortTransactions(filtered, state.sort, state.direction);
  }, [state, transactions]);

  const updateState = (nextState: TransactionTableState) => {
    setSearchParams(buildTransactionTableSearchParams(nextState), { replace: true });
  };

  const updateSort = (sort: TransactionSortKey) => {
    const direction =
      state.sort === sort
        ? state.direction === 'asc'
          ? 'desc'
          : 'asc'
        : sort === 'occurredAt'
          ? 'desc'
          : 'asc';

    updateState({ ...state, sort, direction });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-slate-600">
            Filter and sort transaction history without losing the current view.
          </p>
        </div>
        {onExportStatement ? (
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={onExportStatement}
            type="button"
          >
            Export statement
          </button>
        ) : null}
      </header>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Date
          <select
            aria-label="Date filter"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={state.date}
            onChange={(event) =>
              updateState({ ...state, date: event.target.value as TransactionTableState['date'] })
            }
          >
            {Object.entries(DATE_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Type
          <select
            aria-label="Type filter"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={state.type}
            onChange={(event) =>
              updateState({ ...state, type: event.target.value as TransactionTableState['type'] })
            }
          >
            {Object.entries(TYPE_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Status
          <select
            aria-label="Status filter"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={state.status}
            onChange={(event) =>
              updateState({
                ...state,
                status: event.target.value as TransactionTableState['status'],
              })
            }
          >
            {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>{filteredTransactions.length} transactions</span>
          <span>
            Sorted by {SORT_LABELS[state.sort]} ({state.direction})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {(['occurredAt', 'amount', 'type', 'status'] as const).map((sortKey) => (
                  <th
                    key={sortKey}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                  >
                    <button
                      className="flex items-center gap-1"
                      onClick={() => updateSort(sortKey)}
                      type="button"
                    >
                      {SORT_LABELS[sortKey]}
                      {state.sort === sortKey ? (
                        <span aria-hidden="true">{state.direction === 'asc' ? '↑' : '↓'}</span>
                      ) : null}
                    </button>
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Counterparty
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Merchant
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Memo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {formatDate(transaction.occurredAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {formatAmount(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-slate-700">
                      {transaction.type}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-slate-700">
                      {transaction.status}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{transaction.counterparty}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {transaction.merchant ? (
                        <MerchantBadge
                          merchantName={transaction.merchant.name}
                          status={transaction.merchant.verificationStatus}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{transaction.memo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
