import { describe, expect, it } from 'vitest';
import {
  EXPIRING_SOON_THRESHOLD_MS,
  ONE_DAY_MS,
  getExpiryThreshold,
  getThresholdAnnouncement,
  isRevokedExpiry,
  type ExpiryThreshold,
} from './format-expiry';

describe('getThresholdAnnouncement', () => {
  it.each<[ExpiryThreshold, string]>([
    ['less-than-one-day', 'Session key expires in less than one day.'],
    ['expiring-soon', 'Session key is expiring soon.'],
    ['expired', 'Session key has expired.'],
    ['revoked', 'Session key has been revoked.'],
  ])('returns the expected announcement for %s', (threshold, expected) => {
    expect(getThresholdAnnouncement(threshold)).toBe(expected);
  });

  it('returns an empty string for null', () => {
    expect(getThresholdAnnouncement(null)).toBe('');
  });
});

describe('isRevokedExpiry', () => {
  it('returns true when the expiry is zero', () => {
    expect(isRevokedExpiry(0)).toBe(true);
  });

  it('returns false when the expiry is non-zero', () => {
    expect(isRevokedExpiry(1)).toBe(false);
    expect(isRevokedExpiry(Date.now() + ONE_DAY_MS)).toBe(false);
  });
});

describe('getExpiryThreshold', () => {
  it('returns "revoked" when the expiry is zero', () => {
    expect(getExpiryThreshold(0)).toBe('revoked');
  });

  it('returns "less-than-one-day" exactly at the ONE_DAY_MS boundary (<=)', () => {
    expect(getExpiryThreshold(ONE_DAY_MS)).toBe('less-than-one-day');
  });

  it('returns null just above the ONE_DAY_MS boundary', () => {
    expect(getExpiryThreshold(ONE_DAY_MS + 1)).toBeNull();
  });

  it('returns "expiring-soon" exactly at the EXPIRING_SOON_THRESHOLD_MS boundary (<=)', () => {
    expect(getExpiryThreshold(EXPIRING_SOON_THRESHOLD_MS)).toBe('expiring-soon');
  });

  it('returns "less-than-one-day" just above the EXPIRING_SOON_THRESHOLD_MS boundary', () => {
    expect(getExpiryThreshold(EXPIRING_SOON_THRESHOLD_MS + 1)).toBe('less-than-one-day');
  });
});