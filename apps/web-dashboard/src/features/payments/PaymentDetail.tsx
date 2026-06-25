import { MerchantBadge } from '@ancore/ui-kit';

import type { Transaction } from '../../components/transactions/transaction-types';

interface PaymentDetailProps {
  transaction: Transaction;
}

export function PaymentDetail({ transaction }: PaymentDetailProps) {
  return (
    <aside
      className="rounded-xl border border-slate-200 bg-white p-4"
      aria-labelledby="payment-detail-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment detail
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900" id="payment-detail-title">
            {transaction.counterparty}
          </h2>
        </div>
        {transaction.merchant ? (
          <MerchantBadge
            merchantName={transaction.merchant.name}
            status={transaction.merchant.verificationStatus}
          />
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Amount</dt>
          <dd className="font-medium text-slate-900">${transaction.amount.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="font-medium capitalize text-slate-900">{transaction.status}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Memo</dt>
          <dd className="font-medium text-slate-900">{transaction.memo}</dd>
        </div>
      </dl>
    </aside>
  );
}
