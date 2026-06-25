import * as React from 'react';

export type TransactionHistoryFilter = 'all' | 'sent' | 'received' | 'failed';

export interface EmptyTransactionsProps {
  variant: TransactionHistoryFilter;
  message?: string;
  description?: string;
  onReceive?: () => void;
  onResetFilter?: () => void;
}

interface EmptyConfig {
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}

function getConfig(
  variant: TransactionHistoryFilter,
  onReceive: () => void,
  onResetFilter: () => void
): EmptyConfig {
  switch (variant) {
    case 'sent':
      return {
        title: 'No sent transactions',
        description: 'Sent payments will appear here.',
        ctaLabel: 'Reset filter',
        onCta: onResetFilter,
      };
    case 'received':
      return {
        title: 'No received transactions',
        description: 'Incoming payments will appear here.',
        ctaLabel: 'Reset filter',
        onCta: onResetFilter,
      };
    case 'failed':
      return {
        title: 'No failed transactions',
        description: 'All your transactions succeeded — nice!',
        ctaLabel: 'Reset filter',
        onCta: onResetFilter,
      };
    case 'all':
    default:
      return {
        title: 'No transactions yet',
        description: 'Send or receive XLM to get started.',
        ctaLabel: 'Add Funds',
        onCta: onReceive,
      };
  }
}

export function EmptyTransactions({
  variant,
  message,
  description: descriptionOverride,
  onReceive = () => {},
  onResetFilter = () => {},
}: EmptyTransactionsProps) {
  const config = getConfig(variant, onReceive, onResetFilter);

  const title = message ?? config.title;
  const desc = descriptionOverride ?? config.description;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={title}
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center"
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <button
        type="button"
        onClick={config.onCta}
        className="mt-1 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent"
      >
        {config.ctaLabel}
      </button>
    </div>
  );
}
