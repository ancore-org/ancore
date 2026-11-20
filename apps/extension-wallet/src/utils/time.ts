export type ExpiryTone = 'green' | 'amber' | 'red';

export interface RelativeExpiry {
  label: string;
  tone: ExpiryTone;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Formats an absolute expiry (unix ms, UTC) relative to `now`.
 * Pure epoch arithmetic, so it is timezone independent.
 */
export function formatRelativeExpiry(expiresAt: number, now: number = Date.now()): RelativeExpiry {
  const remaining = expiresAt - now;

  if (remaining <= 0) return { label: 'Expired', tone: 'red' };

  if (remaining < 2 * HOUR_MS) {
    const minutes = Math.floor(remaining / MINUTE_MS);
    return { label: minutes < 1 ? 'Expires in <1m' : `Expires in ${minutes}m`, tone: 'amber' };
  }

  if (remaining < DAY_MS) {
    return { label: `Expires in ${Math.floor(remaining / HOUR_MS)}h`, tone: 'green' };
  }

  return { label: `Expires in ${Math.floor(remaining / DAY_MS)}d`, tone: 'green' };
}
