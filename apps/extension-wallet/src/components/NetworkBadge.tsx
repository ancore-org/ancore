/**
 * NetworkBadge — persistent chip showing the active Stellar network.
 *
 * Always visible in the popup header so users cannot accidentally sign on the
 * wrong network.  Uses distinct colours for mainnet vs test networks so the
 * distinction is impossible to miss.
 *
 * Issue #1032
 */

import type { NetworkMode } from '@/stores/settings';

interface NetworkBadgeProps {
  network: NetworkMode;
  /** Additional Tailwind classes for positioning / spacing overrides */
  className?: string;
}

const NETWORK_STYLES: Record<NetworkMode, { dot: string; badge: string; label: string }> = {
  mainnet: {
    dot: 'bg-emerald-400',
    badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    label: 'Mainnet',
  },
  testnet: {
    dot: 'bg-amber-300',
    badge: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    label: 'Testnet',
  },
  futurenet: {
    dot: 'bg-info',
    badge: 'border-info/20 bg-info/10 text-info',
    label: 'Futurenet',
  },
};

export function NetworkBadge({ network, className = '' }: NetworkBadgeProps) {
  const styles = NETWORK_STYLES[network] ?? NETWORK_STYLES.testnet;

  return (
    <span
      aria-label={`Active network: ${styles.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles.badge} ${className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      {styles.label}
    </span>
  );
}
