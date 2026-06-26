import * as React from 'react';
import { RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import {
  COUNTDOWN_UPDATE_INTERVAL_MS,
  formatExpiryRemaining,
  getExpiryStatus,
  getExpiryThreshold,
  getThresholdAnnouncement,
  isRevokedExpiry,
  type ExpiryStatus,
  type ExpiryThreshold,
} from './format-expiry';

export interface ExpiryCountdownProps {
  expiresAt: number;
  onRefresh?: () => void | Promise<void>;
  refreshLoading?: boolean;
  className?: string;
}

const STATUS_STYLES: Record<ExpiryStatus, string> = {
  active: 'text-muted-foreground',
  'expiring-soon': 'text-warning font-medium',
  expired: 'text-destructive font-medium',
  revoked: 'text-destructive font-medium',
};

function useExpiryCountdown(expiresAt: number) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const announcedThresholdRef = React.useRef<ExpiryThreshold | null>(null);
  const [announcement, setAnnouncement] = React.useState('');

  React.useEffect(() => {
    setNowMs(Date.now());
    announcedThresholdRef.current = null;
    setAnnouncement('');
  }, [expiresAt]);

  React.useEffect(() => {
    if (isRevokedExpiry(expiresAt)) {
      return undefined;
    }

    const tick = () => {
      const nextNow = Date.now();
      setNowMs(nextNow);

      const threshold = getExpiryThreshold(expiresAt, nextNow);
      if (threshold && announcedThresholdRef.current !== threshold) {
        announcedThresholdRef.current = threshold;
        setAnnouncement(getThresholdAnnouncement(threshold));
      }
    };

    tick();
    const intervalId = window.setInterval(tick, COUNTDOWN_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  const status = getExpiryStatus(expiresAt, nowMs);
  const label = formatExpiryRemaining(expiresAt, nowMs);

  return { status, label, announcement };
}

export { useExpiryCountdown };

export const ExpiryCountdown: React.FC<ExpiryCountdownProps> = ({
  expiresAt,
  onRefresh,
  refreshLoading = false,
  className,
}) => {
  const { status, label, announcement } = useExpiryCountdown(expiresAt);
  const refreshDisabled = isRevokedExpiry(expiresAt) || !onRefresh;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn('text-sm', STATUS_STYLES[status])}
        data-testid="expiry-countdown-label"
        data-status={status}
      >
        {label}
      </span>

      {onRefresh && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => void onRefresh()}
          disabled={refreshDisabled || refreshLoading}
          loading={refreshLoading}
          aria-label="Refresh session key expiry"
          data-testid="expiry-refresh-button"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}

      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="expiry-countdown-announcement"
      >
        {announcement}
      </span>
    </div>
  );
};
