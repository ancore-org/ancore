import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  UNLOCK_MAX_ATTEMPTS,
  calculateUnlockBackoffMs,
  checkUnlockRateLimit,
  formatRetryMessage,
  recordUnlockFailure,
  resetUnlockAttempts,
} from '../unlock-rate-limit';

describe('unlock-rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not lock out before the maximum failed attempts', () => {
    const state = recordUnlockFailure(resetUnlockAttempts());
    expect(checkUnlockRateLimit(state).locked).toBe(false);
  });

  it('applies exponential backoff after the threshold', () => {
    let state = resetUnlockAttempts();
    for (let i = 0; i < UNLOCK_MAX_ATTEMPTS; i += 1) {
      state = recordUnlockFailure(state);
    }

    expect(calculateUnlockBackoffMs(state.failedAttempts)).toBe(1_000);
    expect(checkUnlockRateLimit(state).locked).toBe(true);
    expect(checkUnlockRateLimit(state).retryAfterMs).toBe(1_000);
  });

  it('formats a user-visible retry message', () => {
    expect(formatRetryMessage(500)).toBe('Too many failed attempts. Try again in 1 second.');
    expect(formatRetryMessage(5_000)).toBe('Too many failed attempts. Try again in 5 seconds.');
  });

  it('clears expired lockouts lazily', () => {
    let state = resetUnlockAttempts();
    for (let i = 0; i < UNLOCK_MAX_ATTEMPTS; i += 1) {
      state = recordUnlockFailure(state);
    }

    vi.advanceTimersByTime(2_000);
    expect(checkUnlockRateLimit(state).locked).toBe(false);
  });
});
