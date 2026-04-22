import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TransactionItem } from '@/components/TransactionItem';
import { groupTransactionsByDate, type TransactionRecord } from '@/utils/transaction-formatter';

export interface TransactionHistoryProps extends React.HTMLAttributes<HTMLDivElement> {
  transactions: TransactionRecord[];
  onTransactionClick?: (transaction: TransactionRecord) => void;
  loading?: boolean;
  emptyMessage?: string;
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-label="Loading transactions">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function TransactionHistory({
  transactions,
  onTransactionClick,
  loading = false,
  emptyMessage = 'No transactions yet',
  className,
  ...props
}: TransactionHistoryProps) {
  const groups = React.useMemo(() => groupTransactionsByDate(transactions), [transactions]);

  return (
    <Card className={cn('w-full', className)} {...props}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState />
        ) : groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.dateKey} aria-label={`Transactions for ${group.label}`}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((transaction) => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      onClick={onTransactionClick}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
