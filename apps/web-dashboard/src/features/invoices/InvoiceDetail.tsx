import * as React from 'react';
import { Invoice, InvoiceStatus } from '@ancore/types';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ancore/ui-kit';
import { formatAddress, formatTime } from '@ancore/ui-kit';
import { buildPaymentLink } from '../../services/invoice-service';

interface InvoiceDetailProps {
  invoice: Invoice;
  onPay?: (invoice: Invoice) => void;
  onOpen?: (invoice: Invoice) => void;
  onCancel?: (invoice: Invoice) => void;
}

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export function InvoiceDetail({ invoice, onPay, onOpen, onCancel }: InvoiceDetailProps) {
  const [copied, setCopied] = React.useState(false);
  const canOpen = invoice.status === 'draft';
  const canPay = invoice.status === 'open';
  const canCancel = invoice.status === 'open' || invoice.status === 'draft';
  const canShare = invoice.status === 'open';

  const handleCopyLink = async () => {
    const link = buildPaymentLink(invoice.id);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">
            {invoice.reference || `Invoice #${invoice.id.slice(0, 8)}`}
          </CardTitle>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[invoice.status]}`}
          >
            {statusLabels[invoice.status]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Amount</p>
            <p className="text-2xl font-bold">
              {invoice.amount} {invoice.asset}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Recipient</p>
            <p className="font-mono text-sm">{formatAddress(invoice.recipientAddress)}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Created</span>
            <span>{formatTime(new Date(invoice.createdAt))}</span>
          </div>
          {invoice.dueDate && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Due Date</span>
              <span>{formatTime(new Date(invoice.dueDate))}</span>
            </div>
          )}
          {invoice.paidAt && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Paid At</span>
              <span>{formatTime(new Date(invoice.paidAt))}</span>
            </div>
          )}
          {invoice.paymentTransactionId && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="font-mono">{invoice.paymentTransactionId.slice(0, 8)}...</span>
            </div>
          )}
        </div>

        {invoice.description && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{invoice.description}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-4">
          {canOpen && onOpen && (
            <Button onClick={() => onOpen(invoice)} variant="outline" className="flex-1">
              Open Invoice
            </Button>
          )}
          {canPay && onPay && (
            <Button onClick={() => onPay(invoice)} className="flex-1">
              Pay Invoice
            </Button>
          )}
          {canShare && (
            <Button onClick={handleCopyLink} variant="outline">
              {copied ? 'Copied!' : 'Copy Payment Link'}
            </Button>
          )}
          {canCancel && onCancel && (
            <Button onClick={() => onCancel(invoice)} variant="outline" className="flex-1">
              Cancel Invoice
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
