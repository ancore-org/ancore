import React from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ancore/ui-kit';
import { AlertCircle, Key } from 'lucide-react';
import { isSessionKeyActive } from '@ancore/core-sdk';

export interface SessionKeySummary {
  publicKey: string;
  /** Unix timestamp in seconds. `0` indicates a revoked key. */
  expiresAt: number;
  label?: string;
}

export interface SessionKeysPanelProps {
  keys?: SessionKeySummary[];
  isLoading?: boolean;
  error?: Error | null;
  /** Override "now" (ms) for deterministic rendering / testnet mocks. */
  nowMs?: number;
  className?: string;
}

function truncatePublicKey(pk: string): string {
  if (pk.length <= 14) return pk;
  return `${pk.slice(0, 8)}…${pk.slice(-4)}`;
}

/**
 * Read-only panel listing session keys with an active/expired badge.
 *
 * Uses {@link isSessionKeyActive} from `@ancore/core-sdk` to derive the badge
 * so the UI stays in sync with the on-chain semantics implemented by the
 * account contract. The `nowMs` prop makes the component deterministic for
 * tests and for testnet mocks.
 */
export const SessionKeysPanel: React.FC<SessionKeysPanelProps> = ({
  keys,
  isLoading,
  error,
  nowMs,
  className = '',
}) => {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Session Keys</CardTitle>
        <Key className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div data-testid="session-keys-loading" className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : error ? (
          <div
            className="flex items-center space-x-2 text-destructive"
            data-testid="session-keys-error"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Unable to load session keys</span>
          </div>
        ) : !keys || keys.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="session-keys-empty">
            No session keys.
          </p>
        ) : (
          <ul className="divide-y divide-border" data-testid="session-keys-list">
            {keys.map((key) => {
              const active = isSessionKeyActive(
                { expiresAt: key.expiresAt, publicKey: key.publicKey },
                nowMs !== undefined ? { nowMs } : undefined
              );
              return (
                <li
                  key={key.publicKey}
                  className="flex items-center justify-between py-2"
                  data-testid="session-key-row"
                >
                  <span className="font-mono text-xs text-foreground">
                    {key.label ?? truncatePublicKey(key.publicKey)}
                  </span>
                  <Badge variant={active ? 'default' : 'destructive'}>
                    {active ? 'Active' : 'Expired'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionKeysPanel;
