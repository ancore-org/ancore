import { useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';

import { type TransactionStatus } from '../screens/history/types';

type StatusMeta = {
  icon: string;
  label: string;
  color: string;
};

const STATUS_META: Record<TransactionStatus | 'unknown', StatusMeta> = {
  success: {
    icon: '✓',
    label: 'Transaction successful',
    color: '#16a34a',
  },
  completed: {
    icon: '✓',
    label: 'Transaction completed',
    color: '#16a34a',
  },
  pending: {
    icon: '⏳',
    label: 'Transaction pending',
    color: '#d97706',
  },
  failed: {
    icon: '✕',
    label: 'Transaction failed',
    color: '#dc2626',
  },
  unknown: {
    icon: '?',
    label: 'Transaction status unknown',
    color: '#64748b',
  },
};

type Props = {
  status?: TransactionStatus;
  onUnknownStatus?: (status: unknown) => void;
};

export const TransactionStatusIcon = ({ status, onUnknownStatus }: Props) => {
  const normalizedStatus = status ?? 'unknown';
  const meta = STATUS_META[normalizedStatus] ?? STATUS_META.unknown;
  const isUnrecognized = !STATUS_META[normalizedStatus];

  // Log unknown statuses safely for Sentry. Reporting happens in an effect, not
  // during render, so the callback is never fired from an impure render pass.
  // The ref keeps it to one report per distinct status: StrictMode remounts and
  // concurrent re-renders would otherwise fire it repeatedly for one bad value.
  const lastReportedStatus = useRef<unknown>(undefined);

  useEffect(() => {
    if (!isUnrecognized || !onUnknownStatus) return;
    if (lastReportedStatus.current === status) return;

    lastReportedStatus.current = status;
    onUnknownStatus(status);
  }, [isUnrecognized, status, onUnknownStatus]);

  return (
    <Text
      style={[styles.icon, { color: meta.color }]}
      accessibilityLabel={meta.label}
      accessibilityRole="image"
    >
      {meta.icon}
    </Text>
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 20,
    height: 20,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
