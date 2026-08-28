import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  UNLOCK_MAX_ATTEMPTS,
  UNLOCK_BASE_BACKOFF_MS,
  UNLOCK_MAX_BACKOFF_MS,
  calculateUnlockBackoffMs,
  checkUnlockRateLimit,
  formatRetryMessage,
  recordUnlockFailure,
  resetUnlockAttempts,
  type UnlockAttemptState,
} from '../unlock-rate-limit';

describe('unlock-rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateUnlockBackoffMs', () => {
    it('returns 0 for attempts below the threshold', () => {
      expect(calculateUnlockBackoffMs(0)).toBe(0);
      expect(calculateUnlockBackoffMs(1)).toBe(0);
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS - 1)).toBe(0);
    });

    it('returns base backoff at the threshold', () => {
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS)).toBe(UNLOCK_BASE_BACKOFF_MS);
    });

    it('applies exponential backoff after the threshold', () => {
      // At threshold: 1_000 * 2^0 = 1_000
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS)).toBe(1_000);
      // +1: 1_000 * 2^1 = 2_000
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS + 1)).toBe(2_000);
      // +2: 1_000 * 2^2 = 4_000
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS + 2)).toBe(4_000);
      // +3: 1_000 * 2^3 = 8_000
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS + 3)).toBe(8_000);
    });

    it('caps backoff at UNLOCK_MAX_BACKOFF_MS', () => {
      // 1_000 * 2^6 = 64_000, capped at 60_000
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS + 6)).toBe(UNLOCK_MAX_BACKOFF_MS);
      // 1_000 * 2^10 = 1_024_000, capped at 60_000
      expect(calculateUnlockBackoffMs(UNLOCK_MAX_ATTEMPTS + 10)).toBe(UNLOCK_MAX_BACKOFF_MS);
      // Very large attempt count still capped
      expect(calculateUnlockBackoffMs(100)).toBe(UNLOCK_MAX_BACKOFF_MS);
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
  });

  describe('recordUnlockFailure', () => {
    it('increments failedAttempts', () => {
      const state = recordUnlockFailure(resetUnlockAttempts());
      expect(state.failedAttempts).toBe(1);
    });

    it('does not set lockedUntil below threshold', () => {
      const state = recordUnlockFailure(resetUnlockAttempts());
      expect(state.lockedUntil).toBeNull();
    });

    it('sets lockedUntil at threshold', () => {
      let state = resetUnlockAttempts();
      for (let i = 0; i < UNLOCK_MAX_ATTEMPTS; i += 1) {
        state = recordUnlockFailure(state);
      }
      expect(state.lockedUntil).toBe(Date.now() + UNLOCK_BASE_BACKOFF_MS);
    });

    it('doubles lockedUntil duration on each subsequent failure', () => {
      let state = resetUnlockAttempts();
      for (let i = 0; i < UNLOCK_MAX_ATTEMPTS; i += 1) {
        state = recordUnlockFailure(state);
      }
      const firstLockedUntil = state.lockedUntil;

      state = recordUnlockFailure(state);
      const secondLockedUntil = state.lockedUntil;
      expect(secondLockedUntil).toBe(firstLockedUntil! + UNLOCK_BASE_BACKOFF_MS);
    });

    it('caps lockedUntil duration at UNLOCK_MAX_BACKOFF_MS', () => {
      let state = resetUnlockAttempts();
      // Push past the threshold far enough to hit the cap
      for (let i = 0; i < UNLOCK_MAX_ATTEMPTS + 10; i += 1) {
        state = recordUnlockFailure(state);
      }
      expect(state.lockedUntil).toBe(Date.now() + UNLOCK_MAX_BACKOFF_MS);
    });
  });

  describe('checkUnlockRateLimit', () => {
    it('returns unlocked for a fresh state', () => {
      const result = checkUnlockRateLimit(resetUnlockAttempts());
      expect(result.locked).toBe(false);
      expect(result.retryAfterMs).toBe(0);
      expect(result.message).toBeUndefined();
    });

    it('returns locked when within lockout period', () => {
      const state: UnlockAttemptState = {
        failedAttempts: UNLOCK_MAX_ATTEMPTS,
        lockedUntil: Date.now() + 5_000,
      };
      const result = checkUnlockRateLimit(state);
      expect(result.locked).toBe(true);
      expect(result.retryAfterMs).toBe(5_000);
      expect(result.message).toContain('5 seconds');
    });

    it('returns unlocked when lockout has expired', () => {
      const state: UnlockAttemptState = {
        failedAttempts: UNLOCK_MAX_ATTEMPTS,
        lockedUntil: Date.now() - 1_000,
      };
      const result = checkUnlockRateLimit(state);
      expect(result.locked).toBe(false);
      expect(result.retryAfterMs).toBe(0);
    });

    it('returns unlocked when lockedUntil is null', () => {
      const state: UnlockAttemptState = {
        failedAttempts: UNLOCK_MAX_ATTEMPTS,
        lockedUntil: null,
      };
      const result = checkUnlockRateLimit(state);
      expect(result.locked).toBe(false);
    });
  });

  describe('formatRetryMessage', () => {
    it('formats a user-visible retry message', () => {
      expect(formatRetryMessage(500)).toBe('Too many failed attempts. Try again in 1 second.');
      expect(formatRetryMessage(1_000)).toBe('Too many failed attempts. Try again in 1 second.');
      expect(formatRetryMessage(5_000)).toBe('Too many failed attempts. Try again in 5 seconds.');
      expect(formatRetryMessage(60_000)).toBe('Too many failed attempts. Try again in 60 seconds.');
    });
  });

  describe('resetUnlockAttempts', () => {
    it('returns the default state', () => {
      const state = resetUnlockAttempts();
      expect(state.failedAttempts).toBe(0);
      expect(state.lockedUntil).toBeNull();
    });

    it('resets from a locked state', () => {
      let state = resetUnlockAttempts();
      for (let i = 0; i < UNLOCK_MAX_ATTEMPTS + 3; i += 1) {
        state = recordUnlockFailure(state);
      }
      expect(state.failedAttempts).toBeGreaterThan(0);
      expect(state.lockedUntil).not.toBeNull();

      state = resetUnlockAttempts();
      expect(state.failedAttempts).toBe(0);
      expect(state.lockedUntil).toBeNull();
    });
  });

  describe('table-driven attempt count tests', () => {
    it.each([
      { attempts: 0, expectedBackoff: 0, expectedLocked: false },
      { attempts: 1, expectedBackoff: 0, expectedLocked: false },
      { attempts: 2, expectedBackoff: 0, expectedLocked: false },
      { attempts: 3, expectedBackoff: 0, expectedLocked: false },
      { attempts: 4, expectedBackoff: 0, expectedLocked: false },
      { attempts: 5, expectedBackoff: 1_000, expectedLocked: true },
      { attempts: 6, expectedBackoff: 2_000, expectedLocked: true },
      { attempts: 7, expectedBackoff: 4_000, expectedLocked: true },
      { attempts: 8, expectedBackoff: 8_000, expectedLocked: true },
      { attempts: 9, expectedBackoff: 16_000, expectedLocked: true },
      { attempts: 10, expectedBackoff: 32_000, expectedLocked: true },
      { attempts: 11, expectedBackoff: 60_000, expectedLocked: true }, // capped
      { attempts: 12, expectedBackoff: 60_000, expectedLocked: true }, // capped
    ])(
      'backoff for $attempts attempts is $expectedBackoff ms (locked=$expectedLocked)',
      ({ attempts, expectedBackoff, expectedLocked }) => {
        let state = resetUnlockAttempts();
        for (let i = 0; i < attempts; i += 1) {
          state = recordUnlockFailure(state);
        }
        expect(calculateUnlockBackoffMs(state.failedAttempts)).toBe(expectedBackoff);
        expect(checkUnlockRateLimit(state).locked).toBe(expectedLocked);
      }
    );
  });

  describe('edge cases', () => {
    it('handles zero failed attempts gracefully', () => {
      expect(calculateUnlockBackoffMs(0)).toBe(0);
      const result = checkUnlockRateLimit(resetUnlockAttempts());
      expect(result.locked).toBe(false);
    });

    it('handles very large attempt counts without overflow', () => {
      const backoff = calculateUnlockBackoffMs(1_000_000);
      expect(backoff).toBe(UNLOCK_MAX_BACKOFF_MS);
      expect(backoff).toBeLessThanOrEqual(UNLOCK_MAX_BACKOFF_MS);
    });

    it('clears expired lockouts lazily', () => {
      let state = resetUnlockAttempts();
      for (let i = 0; i < UNLOCK_MAX_ATTEMPTS; i += 1) {
        state = recordUnlockFailure(state);
      }

      vi.advanceTimersByTime(2_000);
      expect(checkUnlockRateLimit(state).locked).toBe(false);
    });

    it('maintains lockout until exactly the lockedUntil time', () => {
      let state = resetUnlockAttempts();
      for (let i = 0; i < UNLOCK_MAX_ATTEMPTS; i += 1) {
        state = recordUnlockFailure(state);
      }

      // Just before expiry
      vi.advanceTimersByTime(999);
      expect(checkUnlockRateLimit(state).locked).toBe(true);

      // At exact expiry
      vi.advanceTimersByTime(1);
      expect(checkUnlockRateLimit(state).locked).toBe(false);
    });
  });
});
