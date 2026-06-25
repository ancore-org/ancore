import { render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExpiryCountdown } from './ExpiryCountdown';
import {
  COUNTDOWN_UPDATE_INTERVAL_MS,
  EXPIRING_SOON_THRESHOLD_MS,
  formatExpiryRemaining,
  getExpiryStatus,
  getExpiryThreshold,
} from './format-expiry';

describe('formatExpiryRemaining', () => {
  const now = new Date('2026-06-25T12:00:00.000Z').getTime();

  it('returns Revoked for sentinel expiry', () => {
    expect(formatExpiryRemaining(0, now)).toBe('Revoked');
  });

  it('returns Expired for past timestamps', () => {
    expect(formatExpiryRemaining(now - 1, now)).toBe('Expired');
  });

  it('formats minutes remaining under one hour', () => {
    expect(formatExpiryRemaining(now + 45 * 60_000, now)).toBe('45 minutes remaining');
    expect(formatExpiryRemaining(now + 60_000, now)).toBe('1 minute remaining');
  });

  it('formats hours remaining under one day', () => {
    expect(formatExpiryRemaining(now + 5 * 3_600_000, now)).toBe('5 hours remaining');
  });

  it('formats days remaining', () => {
    expect(formatExpiryRemaining(now + 3 * 86_400_000, now)).toBe('3 days remaining');
  });
});

describe('getExpiryStatus', () => {
  const now = new Date('2026-06-25T12:00:00.000Z').getTime();

  it('detects revoked, expired, expiring-soon, and active states', () => {
    expect(getExpiryStatus(0, now)).toBe('revoked');
    expect(getExpiryStatus(now - 1, now)).toBe('expired');
    expect(getExpiryStatus(now + EXPIRING_SOON_THRESHOLD_MS, now)).toBe('expiring-soon');
    expect(getExpiryStatus(now + EXPIRING_SOON_THRESHOLD_MS + 1, now)).toBe('active');
  });
});

describe('getExpiryThreshold', () => {
  const now = new Date('2026-06-25T12:00:00.000Z').getTime();

  it('returns null for keys with more than one day remaining', () => {
    expect(getExpiryThreshold(now + 2 * 86_400_000, now)).toBeNull();
  });

  it('returns less-than-one-day inside the final day', () => {
    expect(getExpiryThreshold(now + 12 * 3_600_000, now)).toBe('less-than-one-day');
  });
});

describe('ExpiryCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders human-readable remaining time for an active key', () => {
    render(<ExpiryCountdown expiresAt={Date.now() + 2 * 86_400_000} />);
    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent('2 days remaining');
    expect(screen.getByTestId('expiry-countdown-label')).toHaveAttribute('data-status', 'active');
  });

  it('updates the label each minute', () => {
    render(<ExpiryCountdown expiresAt={Date.now() + 90 * 60_000} />);
    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent('1 hour remaining');

    act(() => {
      vi.advanceTimersByTime(COUNTDOWN_UPDATE_INTERVAL_MS);
    });

    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent('1 hour remaining');
  });

  it('styles expired keys distinctly and keeps refresh enabled', () => {
    const onRefresh = vi.fn();

    render(<ExpiryCountdown expiresAt={Date.now() - 60_000} onRefresh={onRefresh} />);

    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent('Expired');
    expect(screen.getByTestId('expiry-countdown-label')).toHaveAttribute('data-status', 'expired');

    fireEvent.click(screen.getByTestId('expiry-refresh-button'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables refresh for revoked keys', () => {
    render(<ExpiryCountdown expiresAt={0} onRefresh={vi.fn()} />);

    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent('Revoked');
    expect(screen.getByTestId('expiry-refresh-button')).toBeDisabled();
  });

  it('announces significant threshold crossings via aria-live region', () => {
    const expiresAt = Date.now() + 30 * 60_000;

    render(<ExpiryCountdown expiresAt={expiresAt} />);
    expect(screen.getByTestId('expiry-countdown-announcement')).toHaveTextContent(
      'Session key expiring in less than one hour'
    );

    act(() => {
      vi.setSystemTime(new Date(expiresAt + 1));
      vi.advanceTimersByTime(COUNTDOWN_UPDATE_INTERVAL_MS);
    });

    expect(screen.getByTestId('expiry-countdown-announcement')).toHaveTextContent(
      'Session key has expired'
    );
  });

  it('shows loading state on refresh button', () => {
    render(<ExpiryCountdown expiresAt={Date.now() + 86_400_000} onRefresh={vi.fn()} refreshLoading />);

    expect(screen.getByTestId('expiry-refresh-button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('expiry-refresh-button')).toBeDisabled();
  });
});
