export const EXPIRING_SOON_THRESHOLD_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const COUNTDOWN_UPDATE_INTERVAL_MS = 60 * 1000;

export type ExpiryStatus = 'active' | 'expiring-soon' | 'expired' | 'revoked';

export type ExpiryThreshold =
  | 'less-than-one-day'
  | 'expiring-soon'
  | 'expired'
  | 'revoked';

export function isRevokedExpiry(expiresAt: number): boolean {
  return expiresAt === 0;
}

export function getExpiryStatus(expiresAt: number, nowMs: number): ExpiryStatus {
  if (isRevokedExpiry(expiresAt)) {
    return 'revoked';
  }

  const remainingMs = expiresAt - nowMs;
  if (remainingMs <= 0) {
    return 'expired';
  }

  if (remainingMs <= EXPIRING_SOON_THRESHOLD_MS) {
    return 'expiring-soon';
  }

  return 'active';
}

export function getExpiryThreshold(expiresAt: number, nowMs: number): ExpiryThreshold | null {
  const status = getExpiryStatus(expiresAt, nowMs);
  if (status === 'revoked') {
    return 'revoked';
  }
  if (status === 'expired') {
    return 'expired';
  }
  if (status === 'expiring-soon') {
    return 'expiring-soon';
  }

  const remainingMs = expiresAt - nowMs;
  if (remainingMs <= ONE_DAY_MS) {
    return 'less-than-one-day';
  }

  return null;
}

export function formatExpiryRemaining(expiresAt: number, nowMs: number): string {
  if (isRevokedExpiry(expiresAt)) {
    return 'Revoked';
  }

  const remainingMs = expiresAt - nowMs;
  if (remainingMs <= 0) {
    return 'Expired';
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'} remaining`;
  }

  const totalHours = Math.floor(remainingMs / 3_600_000);
  if (totalHours < 24) {
    return `${totalHours} hour${totalHours === 1 ? '' : 's'} remaining`;
  }

  const totalDays = Math.floor(remainingMs / 86_400_000);
  return `${totalDays} day${totalDays === 1 ? '' : 's'} remaining`;
}

export function getThresholdAnnouncement(threshold: ExpiryThreshold): string {
  switch (threshold) {
    case 'less-than-one-day':
      return 'Session key expires in less than one day';
    case 'expiring-soon':
      return 'Session key expiring in less than one hour';
    case 'expired':
      return 'Session key has expired';
    case 'revoked':
      return 'Session key has been revoked';
  }
}
