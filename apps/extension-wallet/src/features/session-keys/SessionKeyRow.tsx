import React, { useState } from 'react';
import type { SessionKey } from '@ancore/types';
import { permissionsToLabels } from '@ancore/core-sdk';
import { ExpiryCountdown, useExpiryCountdown, useToast } from '@ancore/ui-kit';

import { refreshSessionKeyTtl } from './refreshSessionKeyTtl';

export interface SessionKeyRowProps {
  sessionKey: SessionKey;
  onRevoke: (publicKey: string) => Promise<void>;
  onRefresh: (publicKey: string, newExpiresAt: number) => Promise<void>;
}

function truncatePublicKey(publicKey: string): string {
  return `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}`;
}

export const SessionKeyRow: React.FC<SessionKeyRowProps> = ({
  sessionKey,
  onRevoke,
  onRefresh,
}) => {
  const { showSuccess, showError } = useToast();
  const [refreshLoading, setRefreshLoading] = useState(false);
  const { status } = useExpiryCountdown(sessionKey.expiresAt);
  const isRevoked = sessionKey.expiresAt === 0;

  const badgeLabel =
    status === 'revoked' ? 'Revoked' : status === 'expired' ? 'Expired' : 'Active';
  const badgeClass =
    status === 'active' || status === 'expiring-soon'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-200 text-gray-500';

  const handleRefresh = async (): Promise<void> => {
    setRefreshLoading(true);
    try {
      await refreshSessionKeyTtl(sessionKey, onRefresh);
      showSuccess('Session key expiry refreshed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh session key';
      showError(message);
    } finally {
      setRefreshLoading(false);
    }
  };

  return (
    <li
      className="flex justify-between items-start rounded border p-3"
      data-testid="session-key-row"
      data-status={status}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {sessionKey.label || 'Unnamed Key'}
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${badgeClass}`}>{badgeLabel}</span>
        </p>
        <p className="text-xs text-gray-500 font-mono mt-0.5">
          {truncatePublicKey(sessionKey.publicKey)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Permissions: {permissionsToLabels(sessionKey.permissions).join(', ')}
        </p>
        <ExpiryCountdown
          className="mt-1"
          expiresAt={sessionKey.expiresAt}
          onRefresh={isRevoked ? undefined : handleRefresh}
          refreshLoading={refreshLoading}
        />
      </div>
      <button
        type="button"
        onClick={() => void onRevoke(sessionKey.publicKey)}
        className="text-red-500 text-sm ml-4 shrink-0"
        aria-label={`Revoke ${sessionKey.label ?? sessionKey.publicKey}`}
        disabled={isRevoked}
      >
        Revoke
      </button>
    </li>
  );
};
