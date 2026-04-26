import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@ancore/ui-kit';
import type { Transaction } from '../types/dashboard';

interface TransactionListProps {
  transactions: Transaction[];
  pageSize?: number;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  pageSize = 5,
}) => {
  const [page, setPage] = useState(0);
  const total = Math.ceil(transactions.length / pageSize);
  const visible = transactions.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions found.</p>
        ) : (
          visible.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <Badge variant={tx.type === 'receive' ? 'default' : 'secondary'}>
                  {tx.type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {tx.timestamp.toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">
                  {tx.type === 'send' ? '-' : '+'}{tx.amount} XLM
                </span>
                <Badge variant={tx.status === 'confirmed' ? 'default' : 'secondary'}>
                  {tx.status}
                </Badge>
              </div>
            </div>
          ))
        )}
        {total > 1 && (
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {total}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= total - 1}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
