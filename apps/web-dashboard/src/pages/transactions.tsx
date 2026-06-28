import { useState } from 'react';

import { TransactionTable } from '../components/transactions/TransactionTable';
import { StatementExportModal } from '../features/statements/StatementExportModal';
import { PaymentDetail } from '../features/payments';
import { mapMerchantMetadata } from '../components/merchant/merchant-metadata';
import type { Transaction } from '../components/transactions/transaction-types';

const STATEMENT_ACCOUNT_ID = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

const DASHBOARD_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    occurredAt: '2026-04-24T10:00:00.000Z',
    type: 'payment',
    status: 'completed',
    amount: 142.5,
    counterparty: 'Acme Treasury',
    memo: 'Invoice 1042',
    merchant: mapMerchantMetadata({
      merchant_name: 'Acme Treasury',
      merchant_verification_status: 'verified',
    }),
  },
  {
    id: 'tx-2',
    occurredAt: '2026-04-24T10:00:00.000Z',
    type: 'swap',
    status: 'completed',
    amount: 142.5,
    counterparty: 'DEX Route',
    memo: 'USDC to XLM',
  },
  {
    id: 'tx-3',
    occurredAt: '2026-04-22T15:30:00.000Z',
    type: 'transfer',
    status: 'pending',
    amount: 85,
    counterparty: 'Client Wallet',
    memo: 'Refund',
  },
  {
    id: 'tx-4',
    occurredAt: '2026-04-18T08:15:00.000Z',
    type: 'payment',
    status: 'failed',
    amount: 12.75,
    counterparty: 'Merchant POS',
    memo: 'Failed charge',
    merchant: mapMerchantMetadata({
      merchant: { name: 'Merchant POS', verificationStatus: 'unverified' },
    }),
  },
  {
    id: 'tx-5',
    occurredAt: '2026-04-23T18:20:00.000Z',
    type: 'transfer',
    status: 'completed',
    amount: 320,
    counterparty: 'Operations Vault',
    memo: 'Liquidity move',
  },
];

export function TransactionsPage() {
  const [isStatementExportOpen, setIsStatementExportOpen] = useState(false);

  return (
    <>
      <div className="space-y-6">
        <PaymentDetail transaction={DASHBOARD_TRANSACTIONS[0]} />
        <TransactionTable
          onExportStatement={() => setIsStatementExportOpen(true)}
          transactions={DASHBOARD_TRANSACTIONS}
        />
      </div>
      <StatementExportModal
        accountId={STATEMENT_ACCOUNT_ID}
        isOpen={isStatementExportOpen}
        onClose={() => setIsStatementExportOpen(false)}
      />
    </>
  );
}
