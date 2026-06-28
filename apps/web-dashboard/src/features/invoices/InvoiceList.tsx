import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { Invoice, InvoiceStatus } from '@ancore/types';
import { formatAddress, formatTime } from '@ancore/ui-kit';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice?: (invoice: Invoice) => void;
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

export function InvoiceList({ invoices, onSelectInvoice }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <p>No invoices found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <Card
          key={invoice.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelectInvoice?.(invoice)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {invoice.reference || `Invoice #${invoice.id.slice(0, 8)}`}
              </CardTitle>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  statusColors[invoice.status]
                }`}
              >
                {statusLabels[invoice.status]}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  {invoice.amount} {invoice.asset}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-mono">{formatAddress(invoice.recipientAddress)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatTime(new Date(invoice.createdAt).getTime())}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{formatTime(new Date(invoice.dueDate).getTime())}</span>
                </div>
              )}
              {invoice.description && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground">{invoice.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
