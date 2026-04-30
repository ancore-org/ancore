/**
 * BiometricLockoutManager — unit tests
 *
 * Covers:
 *  - Initial state and persistence loading
 *  - Attempt counting and lockout triggering
 *  - Time-based lockout expiry
 *  - Permanent lockout
 *  - USER_CANCEL not counting as attempt
 *  - Reset on success
 *  - Corrupt storage recovery
 */

import {
  BiometricLockoutManager,
  type ISecureStorage,
} from '../../security/biometric-lockout-manager';
import {
  BIOMETRIC_MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  LOCKOUT_STORAGE_KEY,
} from '../../security/biometric-lockout.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStorage(initial: Record<string, string> = {}): ISecureStorage {
  const store = { ...initial };
  return {
    getItem: jest.fn(async (key) => store[key] ?? null),
    setItem: jest.fn(async (key, value) => { store[key] = value; }),
    removeItem: jest.fn(async (key) => { delete store[key]; }),
  };
}

function makeManager(storage?: ISecureStorage) {
  return new BiometricLockoutManager(storage ?? makeStorage());
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BiometricLockoutManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Initialization ─────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('starts with default state when storage is empty', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      expect(mgr.isLocked()).toBe(false);
      expect(mgr.getState().failedAttempts).toBe(0);
      expect(mgr.getState().permanentlyLocked).toBe(false);
    });

    it('restores persisted state', async () => {
      const persistedState = {
        failedAttempts: 2,
        lockedUntil: null,
        lastFailureReason: 'AUTHENTICATION_FAILED',
        permanentlyLocked: false,
      };
      const storage = makeStorage({
        [LOCKOUT_STORAGE_KEY]: JSON.stringify(persistedState),
      });
      const mgr = makeManager(storage);
      await mgr.initialize();

      expect(mgr.getState().failedAttempts).toBe(2);
    });

    it('clears expired lockout on initialize', async () => {
      const pastLockout = {
        failedAttempts: 3,
        lockedUntil: Date.now() - 1000, // already expired
        lastFailureReason: 'AUTHENTICATION_FAILED',
        permanentlyLocked: false,
      };
      const storage = makeStorage({
        [LOCKOUT_STORAGE_KEY]: JSON.stringify(pastLockout),
      });
      const mgr = makeManager(storage);
      await mgr.initialize();

      expect(mgr.isLocked()).toBe(false);
      expect(mgr.getState().failedAttempts).toBe(0);
    });

    it('resets on corrupt storage data', async () => {
      const storage = makeStorage({ [LOCKOUT_STORAGE_KEY]: 'NOT_VALID_JSON{{' });
      const mgr = makeManager(storage);
      await mgr.initialize();

      expect(mgr.getState().failedAttempts).toBe(0);
      expect(mgr.isLocked()).toBe(false);
    });
  });

  // ─── Failure recording ──────────────────────────────────────────────────────

  describe('recordFailure()', () => {
    it('increments failedAttempts on AUTHENTICATION_FAILED', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      await mgr.recordFailure('AUTHENTICATION_FAILED');
      expect(mgr.getState().failedAttempts).toBe(1);

      await mgr.recordFailure('AUTHENTICATION_FAILED');
      expect(mgr.getState().failedAttempts).toBe(2);
    });

    it('triggers timed lockout after max attempts', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      for (let i = 0; i < BIOMETRIC_MAX_ATTEMPTS; i++) {
        await mgr.recordFailure('AUTHENTICATION_FAILED');
      }

      expect(mgr.isLocked()).toBe(true);
      expect(mgr.getState().lockedUntil).toBeGreaterThan(Date.now());
    });

    it('does NOT count USER_CANCEL as a failure', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      await mgr.recordFailure('USER_CANCEL');
      expect(mgr.getState().failedAttempts).toBe(0);
      expect(mgr.isLocked()).toBe(false);
    });

    it('sets permanent lockout on LOCKOUT_PERMANENT', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      await mgr.recordFailure('LOCKOUT_PERMANENT');
      expect(mgr.isPermanentlyLocked()).toBe(true);
      expect(mgr.isLocked()).toBe(true);
    });

    it('triggers timed lockout on OS LOCKOUT signal', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      await mgr.recordFailure('LOCKOUT');
      expect(mgr.isLocked()).toBe(true);
      expect(mgr.getState().permanentlyLocked).toBe(false);
    });
  });

  // ─── Lockout timing ─────────────────────────────────────────────────────────

  describe('isLocked() with timer', () => {
    it('returns false after lockout duration elapses', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      for (let i = 0; i < BIOMETRIC_MAX_ATTEMPTS; i++) {
        await mgr.recordFailure('AUTHENTICATION_FAILED');
      }
      expect(mgr.isLocked()).toBe(true);

      // Advance past lockout
      jest.advanceTimersByTime(LOCKOUT_DURATION_MS + 100);
      expect(mgr.isLocked()).toBe(false);
    });

    it('remainingLockoutMs returns 0 when not locked', async () => {
      const mgr = makeManager();
      await mgr.initialize();
      expect(mgr.remainingLockoutMs()).toBe(0);
    });

    it('remainingLockoutMs returns positive ms during lockout', async () => {
      const mgr = makeManager();
      await mgr.initialize();
      for (let i = 0; i < BIOMETRIC_MAX_ATTEMPTS; i++) {
        await mgr.recordFailure('AUTHENTICATION_FAILED');
      }
      expect(mgr.remainingLockoutMs()).toBeGreaterThan(0);
    });
  });

  // ─── Success reset ───────────────────────────────────────────────────────────

  describe('recordSuccess()', () => {
    it('resets all state after success', async () => {
      const mgr = makeManager();
      await mgr.initialize();

      await mgr.recordFailure('AUTHENTICATION_FAILED');
      await mgr.recordFailure('AUTHENTICATION_FAILED');
      await mgr.recordSuccess();

      expect(mgr.getState().failedAttempts).toBe(0);
      expect(mgr.isLocked()).toBe(false);
    });
  });

  // ─── Persistence ─────────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('calls storage.setItem on each failure', async () => {
      const storage = makeStorage();
      const mgr = makeManager(storage);
      await mgr.initialize();

      await mgr.recordFailure('AUTHENTICATION_FAILED');
      expect(storage.setItem).toHaveBeenCalledWith(
        LOCKOUT_STORAGE_KEY,
        expect.any(String),
      );
    });

    it('calls storage.removeItem on reset', async () => {
      const storage = makeStorage();
      const mgr = makeManager(storage);
      await mgr.initialize();

      await mgr.reset();
      expect(storage.removeItem).toHaveBeenCalledWith(LOCKOUT_STORAGE_KEY);
    });
  });
});