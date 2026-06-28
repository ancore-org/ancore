import * as React from 'react';
import { CheckCircle, Clock3, HelpCircle, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

export type MerchantBadgeStatus = 'verified' | 'pending' | 'unverified' | 'unknown';

export interface MerchantBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: MerchantBadgeStatus | null;
  merchantName?: string | null;
}

const STATUS_CONTENT: Record<
  MerchantBadgeStatus,
  { label: string; description: string; className: string; icon: React.ReactNode }
> = {
  verified: {
    label: 'Verified',
    description: 'Merchant identity has been verified by Ancore.',
    className: 'border-primary/30 bg-primary/10 text-primary',
    icon: <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  pending: {
    label: 'Pending review',
    description: 'Merchant verification is under review.',
    className: 'border-secondary bg-secondary text-secondary-foreground',
    icon: <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  unverified: {
    label: 'Unverified',
    description: 'Merchant identity has not been verified.',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon: <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  unknown: {
    label: 'Unknown',
    description: 'Merchant verification status is unavailable.',
    className: 'border-border bg-muted text-muted-foreground',
    icon: <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  },
};

function normalizeStatus(status: MerchantBadgeProps['status']): MerchantBadgeStatus {
  if (status === 'verified' || status === 'pending' || status === 'unverified') {
    return status;
  }
  return 'unknown';
}

export function MerchantBadge({ className, merchantName, status, ...props }: MerchantBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const content = STATUS_CONTENT[normalizedStatus];
  const accessibleName = merchantName
    ? `${merchantName} merchant verification: ${content.label}`
    : `Merchant verification: ${content.label}`;

  return (
    <div
      aria-label={accessibleName}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
        content.className,
        className
      )}
      role="status"
      title={content.description}
      {...props}
    >
      {content.icon}
      <span>{content.label}</span>
      <span className="sr-only">. {content.description}</span>
    </div>
  );
}
