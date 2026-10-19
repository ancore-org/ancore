import React from 'react';
import { NetworkBadge } from './NetworkBadge';
import { useAccountStore } from '@/stores/account';
import { useSettingsStore, type NetworkMode } from '@/stores/settings';

export interface HeaderProps {
  address?: string;
  network?: NetworkMode | string;
  className?: string;
}

export function Header({
  address: propAddress,
  network: propNetwork,
  className = '',
}: HeaderProps) {
  const storeAccount = useAccountStore((s) => s.address);
  const storeNetwork = useSettingsStore((s) => s.network);

  const activeAddress = propAddress || storeAccount || '';
  const activeNetwork = propNetwork || storeNetwork;

  const truncatedAddress = activeAddress
    ? `${activeAddress.slice(0, 4)}...${activeAddress.slice(-4)}`
    : 'Not connected';

  return (
    <header
      data-testid="extension-header"
      className={`flex items-center justify-between border-b border-white/5 bg-background/80 px-4 py-3 backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-cyan-500 to-primary/80 flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0">
          A
        </div>
        <span
          data-testid="header-address"
          className="font-mono text-xs font-medium text-foreground truncate"
        >
          {truncatedAddress}
        </span>
      </div>

      <div className="shrink-0">
        <NetworkBadge network={activeNetwork} />
      </div>
    </header>
  );
}

export default Header;
