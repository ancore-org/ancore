import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, cn } from '@ancore/ui-kit';
import { format } from 'date-fns';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';

import { TransactionStatus, type TransactionStatusKind } from '@/components/TransactionStatus';
import { getTransactionExplorerLink, type StellarNetwork } from '@/utils/explorer-links';

export interface TransactionDetailData {
  id?: string;
  status: TransactionStatusKind;
  type: 'sent' | 'received' | 'swap' | 'payment';
  from: string;
  to: string;
  amount: string;
  assetCode?: string;
  fee: string;
  memo?: string | null;
  timestamp: string | Date;
  blockNumber?: number | string | null;
  hash: string;
  network?: StellarNetwork;
}

export interface TransactionDetailProps {
  transaction: TransactionDetailData;
  onBack?: () => void;
  className?: string;
}

function formatDateTime(value: string | Date): string {
  return format(new Date(value), 'MMM d, yyyy, h:mm a');
}

function getHeadline(transaction: TransactionDetailData): string {
  const assetCode = transaction.assetCode ?? 'XLM';
  const prefix =
    transaction.type === 'received'
      ? 'Received'
      : transaction.type === 'swap'
        ? 'Swapped'
        : transaction.type === 'payment'
          ? 'Payment'
          : 'Sent';

  return `${prefix} ${transaction.amount} ${assetCode}`;
}

function getCounterpartyLabel(type: TransactionDetailData['type']): string {
  return type === 'received' ? 'From' : 'To';
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) {
    return hash;
  }

  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export function TransactionDetail({ transaction, onBack, className }: TransactionDetailProps) {
  const [copied, setCopied] = React.useState(false);

  const explorerLink = getTransactionExplorerLink(
    transaction.hash,
    transaction.network ?? 'mainnet'
  );

  const handleCopy = React.useCallback(async () => {
    await copyText(transaction.hash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [transaction.hash]);

  return (
    <Card className={cn('mx-auto w-full max-w-md border-slate-200', className)}>
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" aria-label="Go back" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <CardTitle className="text-lg">Details</CardTitle>
        </div>
        <TransactionStatus status={transaction.status} />
      </CardHeader>

      <CardContent className="space-y-6">
        <section className="space-y-2">
          <p className="text-2xl font-semibold tracking-tight text-slate-950">
            {getHeadline(transaction)}
          </p>
          <p className="text-sm text-slate-600">
            {getCounterpartyLabel(transaction.type)}:{' '}
            <span className="font-mono text-slate-900">
              {transaction.type === 'received' ? transaction.from : transaction.to}
            </span>
          </p>
        </section>

        <Separator />

        <dl className="grid gap-4 text-sm sm:grid-cols-[minmax(120px,140px)_1fr]">
          <div className="contents">
            <dt className="font-medium text-slate-500">From</dt>
            <dd className="font-mono break-all text-slate-900">{transaction.from}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-slate-500">To</dt>
            <dd className="font-mono break-all text-slate-900">{transaction.to}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-slate-500">Amount</dt>
            <dd className="text-slate-900">
              {transaction.amount} {transaction.assetCode ?? 'XLM'}
            </dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-slate-500">Fee</dt>
            <dd className="text-slate-900">{transaction.fee}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-slate-500">Memo</dt>
            <dd className="break-words text-slate-900">
              {transaction.memo?.trim() ? transaction.memo : 'No memo'}
            </dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-slate-500">Time</dt>
            <dd className="text-slate-900">{formatDateTime(transaction.timestamp)}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-slate-500">Block</dt>
            <dd className="text-slate-900">{transaction.blockNumber ?? 'Not available'}</dd>
          </div>
          <div className="contents">
            <dt className="font-medium text-slate-500">TX Hash</dt>
            <dd className="space-y-3">
              <code
                className="block break-all rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-900"
                title={transaction.hash}
              >
                {truncateHash(transaction.hash)}
              </code>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={explorerLink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View on Stellar Expert"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View Explorer
                  </a>
                </Button>
              </div>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export { copyText, formatDateTime, getCounterpartyLabel, getHeadline, truncateHash };
