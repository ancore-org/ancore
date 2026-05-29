/**
 * ServiceHealthBanner
 *
 * Displays a user-visible error banner when the relayer or indexer is
 * unreachable. Includes a link to Settings so the user can review their
 * environment configuration.
 *
 * Issue #567
 */

import * as React from 'react';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import type { ConfigError } from '@/config/urls';

interface ServiceHealthBannerProps {
  errors: ConfigError[];
  onRetry?: () => void;
  onOpenSettings?: () => void;
  className?: string;
}

export function ServiceHealthBanner({
  errors,
  onRetry,
  onOpenSettings,
  className = '',
}: ServiceHealthBannerProps) {
  if (errors.length === 0) return null;

  const hasRelayerError = errors.some((e) => e.service === 'relayer');
  const hasIndexerError = errors.some((e) => e.service === 'indexer');

  const title = hasRelayerError
    ? 'Relayer unreachable — send is disabled'
    : 'Indexer unreachable — balance may be stale';

  const description = errors
    .map((e) => {
      const label = e.service === 'relayer' ? 'Relayer' : 'Indexer';
      return `${label}: ${e.message}`;
    })
    .join(' · ');

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 ${className}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-destructive">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
          {description}
        </p>

        <div className="flex items-center gap-3 mt-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label="Open settings to review service URLs"
            >
              <Settings className="h-3 w-3" aria-hidden="true" />
              Settings
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label="Retry service health check"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Invisible but accessible summary for screen readers */}
      <span className="sr-only">
        {hasRelayerError && 'Send transactions are currently disabled. '}
        {hasIndexerError && 'Balance information may be outdated. '}
        Check Settings to review your environment configuration.
      </span>
    </div>
  );
}
