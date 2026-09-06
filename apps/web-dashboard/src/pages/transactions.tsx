import { useMemo, useState } from 'react';

import { TransactionTable } from '../components/transactions/TransactionTable';
import { StatementExportModal } from '../features/statements/StatementExportModal';
import { PaymentDetail } from '../features/payments';
import { mapMerchantMetadata } from '../components/merchant/merchant-metadata';
import type { Transaction as TableTransaction } from '../components/transactions/transaction-types';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { useIndexerActivity } from '../hooks/useIndexerActivity';

function mapIndexerToTable(tx: any): TableTransaction {
  return {
    id: tx.id,
    occurredAt:
      tx.timestamp instanceof Date
        ? tx.timestamp.toISOString()
        : new Date(tx.timestamp).toISOString(),
    type: tx.type === 'send' ? 'transfer' : 'payment',
    status:
      tx.status === 'confirmed' ? 'completed' : tx.status === 'pending' ? 'pending' : 'failed',
    amount: tx.amount,
    counterparty: tx.counterparty,
    memo: tx.memo ?? '',
    merchant: tx.merchant ? mapMerchantMetadata(tx.merchant) : null,
  };
}

export function TransactionsPage() {
  const [isStatementExportOpen, setIsStatementExportOpen] = useState(false);
  const { smartAccountId } = useWalletConnection();

  const { items: indexerItems } = useIndexerActivity(smartAccountId ?? '');

  const transactions: TableTransaction[] = useMemo(
    () => indexerItems.map((t) => mapIndexerToTable(t)),
    [indexerItems]
  );

  return (
    <>
      <div className="space-y-6">
        {transactions[0] ? <PaymentDetail transaction={transactions[0]} /> : null}
        <TransactionTable
          onExportStatement={() => setIsStatementExportOpen(true)}
          transactions={transactions}
        />
      </div>
      <StatementExportModal
        accountId={smartAccountId ?? ''}
        isOpen={isStatementExportOpen}
        onClose={() => setIsStatementExportOpen(false)}
      />
    </>
  );
}
