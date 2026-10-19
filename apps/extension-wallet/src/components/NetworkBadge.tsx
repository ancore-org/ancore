/**
 * NetworkBadge — visual network pill indicator on popup header.
 *
 * Displays a colored pill indicator showing whether the user is on
 * Testnet (yellow), Mainnet (green), or Futurenet (purple).
 * Reads the active network from useSettingsStore if not explicitly passed as a prop.
 *
 * Issue #1508
 */

import React from 'react';
import { useSettingsStore, type NetworkMode } from '@/stores/settings';

export interface NetworkBadgeProps {
  network?: NetworkMode | string;
  /** Additional Tailwind classes for positioning / spacing overrides */
  className?: string;
  testId?: string;
}

const NETWORK_STYLES: Record<
  NetworkMode,
  { dot: string; badge: string; label: string; textClass: string }
> = {
  mainnet: {
    dot: 'bg-emerald-400',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    label: 'MAINNET',
    textClass: 'text-emerald-400',
  },
  testnet: {
    dot: 'bg-amber-400',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    label: 'TESTNET',
    textClass: 'text-amber-400',
  },
  futurenet: {
    dot: 'bg-purple-400',
    badge: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    label: 'FUTURENET',
    textClass: 'text-purple-400',
  },
};

export function NetworkBadge({
  network: propNetwork,
  className = '',
  testId = 'network-badge',
}: NetworkBadgeProps) {
  const storeNetwork = useSettingsStore((state) => state.network);
  const activeNetworkRaw = (propNetwork || storeNetwork || 'testnet').toString().toLowerCase();

  const normalizedNetwork: NetworkMode =
    activeNetworkRaw === 'mainnet'
      ? 'mainnet'
      : activeNetworkRaw === 'futurenet'
        ? 'futurenet'
        : 'testnet';

  const styles = NETWORK_STYLES[normalizedNetwork];

  return (
    <span
      data-testid={testId}
      data-network={normalizedNetwork}
      aria-label={`Active network: ${styles.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm ${styles.badge} ${className}`}
    >
      <span
        data-testid="network-dot"
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${styles.dot} animate-pulse`}
      />
      <span>{styles.label}</span>
    </span>
  );
}

export default NetworkBadge;
