import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@ancore/ui-kit';
import { Download, Clock, AlertCircle } from 'lucide-react';
import type { Transaction } from '../types/dashboard';
import { useTableDensity } from '../contexts/TableDensityContext';

interface TransactionListProps {
  transactions: Transaction[];
  pageSize?: number;
  optimisticTransaction?: Transaction | null;
  isProcessing?: boolean;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  pageSize = 5,
  optimisticTransaction = null,
  isProcessing = false,
}) => {
  const { density } = useTableDensity();
  const [page, setPage] = useState(0);

  // Combine optimistic and confirmed transactions
  const allTransactions = optimisticTransaction
    ? [optimisticTransaction, ...transactions]
    : transactions;

  const total = Math.ceil(allTransactions.length / pageSize);
  const visible = allTransactions.slice(page * pageSize, (page + 1) * pageSize);

  const handleExportCSV = () => {
    if (transactions.length === 0) return;

    const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const headers = ['ID', 'Type', 'Amount (XLM)', 'Timestamp', 'Status', 'Counterparty'];
    const rows = transactions.map((tx) => [
      escapeCSV(tx.id),
      escapeCSV(tx.type),
      escapeCSV(tx.amount.toString()),
      escapeCSV(tx.timestamp.toISOString()),
      escapeCSV(tx.status),
      escapeCSV(tx.counterparty),
    ]);

    const csvContent = [headers.map(escapeCSV), ...rows].map((row) => row.join(',')).join('\n');
    const blob = new window.Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadgeVariant = (status: 'confirmed' | 'pending', isOptimistic: boolean) => {
    if (isOptimistic && status === 'pending') {
      return 'secondary';
    }
    return status === 'confirmed' ? 'default' : 'secondary';
  };

  const getStatusDisplay = (status: 'confirmed' | 'pending', isOptimistic: boolean) => {
    if (isOptimistic && status === 'pending') {
      return 'pending (optimistic)';
    }
    return status;
  };

  const densityPadding = density === 'compact' ? 'py-1' : 'py-2';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Transactions</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={transactions.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className={density === 'compact' ? 'space-y-1' : 'space-y-2'}>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions found.</p>
        ) : (
          visible.map((tx, index) => {
            const isOptimistic = tx.id === optimisticTransaction?.id;
            const rowClassName = isOptimistic ? 'bg-amber-50 border-l-2 border-amber-500 pl-2' : '';

            return (
              <div
                key={`${tx.id}-${index}`}
                className={`flex items-center justify-between ${densityPadding} border-b last:border-0 ${rowClassName}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={tx.type === 'receive' ? 'default' : 'secondary'}>
                      {tx.type}
                    </Badge>
                    {isOptimistic && <Clock className="w-4 h-4 text-amber-600" />}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {tx.timestamp.toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {tx.type === 'send' ? '-' : '+'}
                    {tx.amount} XLM
                  </span>
                  <Badge variant={getStatusBadgeVariant(tx.status, isOptimistic)}>
                    {getStatusDisplay(tx.status, isOptimistic)}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
        {total > 1 && (
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= total - 1}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
