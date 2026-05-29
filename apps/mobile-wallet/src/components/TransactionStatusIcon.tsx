import { type TransactionStatus } from '../screens/history/types';

type StatusMeta = {
  icon: string;
  label: string;
  className: string;
};

const STATUS_META: Record<TransactionStatus | 'unknown', StatusMeta> = {
  success: {
    icon: '✓',
    label: 'Transaction successful',
    className: 'text-green-600',
  },
  completed: {
    icon: '✓',
    label: 'Transaction completed',
    className: 'text-green-600',
  },
  pending: {
    icon: '⏳',
    label: 'Transaction pending',
    className: 'text-amber-600',
  },
  failed: {
    icon: '✕',
    label: 'Transaction failed',
    className: 'text-red-600',
  },
  unknown: {
    icon: '?',
    label: 'Transaction status unknown',
    className: 'text-slate-500',
  },
};

type Props = {
  status?: TransactionStatus;
  onUnknownStatus?: (status: unknown) => void;
};

export const TransactionStatusIcon = ({ status, onUnknownStatus }: Props) => {
  const normalizedStatus = status ?? 'unknown';
  const meta = STATUS_META[normalizedStatus] ?? STATUS_META.unknown;

  // Log unknown statuses safely for Sentry
  if (!STATUS_META[normalizedStatus] && onUnknownStatus) {
    onUnknownStatus(status);
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 font-semibold ${meta.className}`}
      aria-label={meta.label}
      role="img"
    >
      {meta.icon}
    </span>
  );
};
