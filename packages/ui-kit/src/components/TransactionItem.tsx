import * as React from 'react';
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiRefreshCw,
  FiRepeat,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
import { cn } from '@/lib/utils';
import {
  formatAddress,
  formatTime,
  formatTransactionAmount,
  type TransactionRecord,
  type TransactionStatus,
} from '@/utils/transaction-formatter';

const STATUS_STYLES: Record<TransactionStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  sent: <FiArrowUpRight className="h-4 w-4" aria-hidden="true" />,
  received: <FiArrowDownLeft className="h-4 w-4" aria-hidden="true" />,
  swap: <FiRepeat className="h-4 w-4" aria-hidden="true" />,
  payment: <FiRefreshCw className="h-4 w-4" aria-hidden="true" />,
  deposit: <FiTrendingUp className="h-4 w-4" aria-hidden="true" />,
  withdrawal: <FiTrendingDown className="h-4 w-4" aria-hidden="true" />,
};

export interface TransactionItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  transaction: TransactionRecord;
  onClick?: (transaction: TransactionRecord) => void;
}

export function TransactionItem({
  transaction,
  onClick,
  className,
  ...props
}: TransactionItemProps) {
  const isOutgoing = transaction.type === 'sent' || transaction.type === 'withdrawal';
  const icon = TYPE_ICONS[transaction.type] ?? (
    <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
  );

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border border-slate-200 px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      onClick={() => onClick?.(transaction)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-600">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium capitalize text-slate-900">{transaction.type}</p>
            <p className="text-xs text-slate-500">
              {formatAddress(transaction.from)} → {formatAddress(transaction.to)}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p
            className={cn(
              'text-sm font-semibold',
              isOutgoing ? 'text-slate-900' : 'text-emerald-700'
            )}
          >
            {isOutgoing ? '-' : '+'}
            {formatTransactionAmount(transaction.amount, transaction.assetCode)}
          </p>
          <p className="text-xs text-slate-500">{formatTime(transaction.timestamp)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
            STATUS_STYLES[transaction.status]
          )}
        >
          {transaction.status}
        </span>
      </div>
    </button>
  );
}
