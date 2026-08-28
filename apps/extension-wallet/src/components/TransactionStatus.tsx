import * as React from 'react';
import { Badge } from '@ancore/ui-kit';
import type { BadgeProps } from '@ancore/ui-kit';
import { AlertCircle, CheckCircle2, Clock3, XCircle } from 'lucide-react';

export type TransactionStatusKind = 'confirmed' | 'pending' | 'failed' | 'cancelled';

const STATUS_CONFIG: Record<
  TransactionStatusKind,
  { label: string; icon: React.ReactNode; variant: BadgeProps['variant'] }
> = {
  confirmed: {
    label: 'Confirmed',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    variant: 'success',
  },
  pending: {
    label: 'Pending',
    icon: <Clock3 className="h-4 w-4" aria-hidden="true" />,
    variant: 'pending',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
    variant: 'failed',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
    variant: 'warning',
  },
};

export interface TransactionStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  status: TransactionStatusKind;
}

export function TransactionStatus({ status, className, ...props }: TransactionStatusProps) {
  const { label, icon, variant } = STATUS_CONFIG[status];

  return (
    <Badge
      variant={variant}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${className ?? ''}`}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </Badge>
  );
}
