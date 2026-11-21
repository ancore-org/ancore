import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type Handler = (params: unknown) => Promise<unknown>;

const registeredHandlers = new Map<string, Handler>();

vi.mock('@/messaging', () => ({
  registerHandler: vi.fn((type: string, handler: Handler) => {
    registeredHandlers.set(type, handler);
  }),
}));

const readAuthStateMock = vi.fn();
vi.mock('@/router/AuthGuard', () => ({
  readAuthState: (...args: unknown[]) => readAuthStateMock(...args),
}));

const lockMock = vi.fn();
const unlockMock = vi.fn();
const getSharedStorageManagerMock = vi.fn();
vi.mock('@/security/storage-manager', () => ({
  getSharedStorageManager: (...args: unknown[]) => getSharedStorageManagerMock(...args),
}));

const setBackgroundSessionUnlockedMock = vi.fn();
const clearUnlockSessionMock = vi.fn();
const persistUnlockSessionMock = vi.fn();
vi.mock('../session-state', () => ({
  setBackgroundSessionUnlocked: (...args: unknown[]) => setBackgroundSessionUnlockedMock(...args),
  clearUnlockSession: (...args: unknown[]) => clearUnlockSessionMock(...args),
  persistUnlockSession: (...args: unknown[]) => persistUnlockSessionMock(...args),
}));

const setChromeLocalStorageMock = vi.fn();
vi.mock('../chrome-storage', () => ({
  setChromeLocalStorage: (...args: unknown[]) => setChromeLocalStorageMock(...args),
}));

const createLoggerMock = vi.fn();
vi.mock('../logger', () => ({
  createLogger: (...args: unknown[]) => createLoggerMock(...args),
}));

const loadUnlockAttemptStateMock = vi.fn();
const saveUnlockAttemptStateMock = vi.fn();
const clearUnlockAttemptStateMock = vi.fn();
const checkUnlockRateLimitMock = vi.fn();
const recordUnlockFailureMock = vi.fn();
vi.mock('@/background/unlock-rate-limit', () => ({
  loadUnlockAttemptState: (...args: unknown[]) => loadUnlockAttemptStateMock(...args),
  saveUnlockAttemptState: (...args: unknown[]) => saveUnlockAttemptStateMock(...args),
  clearUnlockAttemptState: (...args: unknown[]) => clearUnlockAttemptStateMock(...args),
  checkUnlockRateLimit: (...args: unknown[]) => checkUnlockRateLimitMock(...args),
  recordUnlockFailure: (...args: unknown[]) => recordUnlockFailureMock(...args),
}));

// ---------------------------------------------------------------------------
// Subject under test (imported after mocks are declared)
// ---------------------------------------------------------------------------

import { executeLockWallet, registerLockUnlockHandlers } from '../lock-unlock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function getHandler(type: string): Handler {
  const handler = registeredHandlers.get(type);
  if (!handler) {
    throw new Error(`Handler for ${type} was not registered`);
  }
  return handler;
}

const EMPTY_ATTEMPT_STATE = {
  failedAttempts: 0,
  lastFailedAt: null,
};

const ALLOWED_RATE_LIMIT = {
  allowed: true,
  retryAfterMs: 0,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lock-unlock handlers', () => {
  beforeEach(() => {
    registeredHandlers.clear();
    vi.clearAllMocks();

    createLoggerMock.mockReturnValue(logger);

    getSharedStorageManagerMock.mockReturnValue({
      lock: lockMock,
      unlock: unlockMock,
    });

    lockMock.mockResolvedValue(undefined);
    unlockMock.mockResolvedValue(undefined);
    setBackgroundSessionUnlockedMock.mockResolvedValue(undefined);
    clearUnlockSessionMock.mockResolvedValue(undefined);
    persistUnlockSessionMock.mockResolvedValue(undefined);
    setChromeLocalStorageMock.mockResolvedValue(undefined);

    loadUnlockAttemptStateMock.mockResolvedValue({ ...EMPTY_ATTEMPT_STATE });
    saveUnlockAttemptStateMock.mockResolvedValue(undefined);
    clearUnlockAttemptStateMock.mockResolvedValue(undefined);
    checkUnlockRateLimitMock.mockReturnValue({ ...ALLOWED_RATE_LIMIT });
    recordUnlockFailureMock.mockReturnValue({
      failedAttempts: 1,
      lastFailedAt: Date.now(),
    });

    readAuthStateMock.mockResolvedValue({ isUnlocked: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // executeLockWallet
  // -------------------------------------------------------------------------

  describe('executeLockWallet', () => {
    it('locks the wallet, clears the session and persists isUnlocked: false', async () => {
      const result = await executeLockWallet();

      expect(result).toBe(true);
      expect(setBackgroundSessionUnlockedMock).toHaveBeenCalledTimes(1);
      expect(setBackgroundSessionUnlockedMock).toHaveBeenCalledWith(false);
      expect(lockMock).toHaveBeenCalledTimes(1);
      expect(clearUnlockSessionMock).toHaveBeenCalledTimes(1);
      expect(setChromeLocalStorageMock).toHaveBeenCalledWith(
        expect.objectContaining({ isUnlocked: false }),
      );
    });

    it('returns false without throwing when lock() rejects', async () => {
      lockMock.mockRejectedValueOnce(new Error('lock failed'));

      await expect(executeLockWallet()).resolves.toBe(false);
      expect(lockMock).toHaveBeenCalledTimes(1);
    });

    it('returns false without throwing when clearUnlockSession() rejects', async () => {
      clearUnlockSessionMock.mockRejectedValueOnce(new Error('clear failed'));

      await expect(executeLockWallet()).resolves.toBe(false);
      expect(clearUnlockSessionMock).toHaveBeenCalledTimes(1);
    });

    it('returns false without throwing when setBackgroundSessionUnlocked() rejects', async () => {
      setBackgroundSessionUnlockedMock.mockRejectedValueOnce(new Error('session failed'));

      await expect(executeLockWallet()).resolves.toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // registerLockUnlockHandlers
  // -------------------------------------------------------------------------

  describe('registerLockUnlockHandlers', () => {
    it('registers the LOCK_WALLET and UNLOCK_WALLET handlers', () => {
      registerLockUnlockHandlers();

      expect(registeredHandlers.has('LOCK_WALLET')).toBe(true);
      expect(registeredHandlers.has('UNLOCK_WALLET')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // LOCK_WALLET handler
  // -------------------------------------------------------------------------

  describe('LOCK_WALLET handler', () => {
    beforeEach(() => {
      registerLockUnlockHandlers();
    });

    it('delegates to executeLockWallet', async () => {
      const handler = getHandler('LOCK_WALLET');

      const result = await handler({});

      expect(result).toEqual({ success: true });
      expect(setBackgroundSessionUnlockedMock).toHaveBeenCalledWith(false);
      expect(lockMock).toHaveBeenCalledTimes(1);
      expect(clearUnlockSessionMock).toHaveBeenCalledTimes(1);
    });

    it('returns failure when executeLockWallet fails', async () => {
      lockMock.mockRejectedValueOnce(new Error('lock failed'));
      const handler = getHandler('LOCK_WALLET');

      const result = await handler({});

      expect(result).toEqual({ success: false });
    });
  });

  // -------------------------------------------------------------------------
  // UNLOCK_WALLET handler
  // -------------------------------------------------------------------------

  describe('UNLOCK_WALLET handler', () => {
    beforeEach(() => {
      registerLockUnlockHandlers();
    });

    it('returns { success: false } for an empty password without touching storage', async () => {
      const handler = getHandler('UNLOCK_WALLET');

      const result = await handler({ password: '' });

      expect(result).toEqual({ success: false });
      expect(loadUnlockAttemptStateMock).not.toHaveBeenCalled();
      expect(unlockMock).not.toHaveBeenCalled();
      expect(persistUnlockSessionMock).not.toHaveBeenCalled();
      expect(setChromeLocalStorageMock).not.toHaveBeenCalled();
    });

    it('returns { success: false } for a non-string password without touching storage', async () => {
      const handler = getHandler('UNLOCK_WALLET');

      const result = await handler({ password: 12345 });

      expect(result).toEqual({ success: false });
      expect(loadUnlockAttemptStateMock).not.toHaveBeenCalled();
      expect(unlockMock).not.toHaveBeenCalled();
      expect(persistUnlockSessionMock).not.toHaveBeenCalled();
      expect(setChromeLocalStorageMock).not.toHaveBeenCalled();
    });

    it('returns { success: false } when password is missing', async () => {
      const handler = getHandler('UNLOCK_WALLET');

      const result = await handler({});

      expect(result).toEqual({ success: false });
      expect(unlockMock).not.toHaveBeenCalled();
    });

    it('returns a throttled failure with retryAfterMs and does not call unlock()', async () => {
      checkUnlockRateLimitMock.mockReturnValueOnce({
        allowed: false,
        retryAfterMs: 30_000,
      });
      const handler = getHandler('UNLOCK_WALLET');

      const result = await handler({ password: 'correct-password' });

      expect(result).toEqual({ success: false, retryAfterMs: 30_000 });
      expect(unlockMock).not.toHaveBeenCalled();
      expect(persistUnlockSessionMock).not.toHaveBeenCalled();
      expect(setChromeLocalStorageMock).not.toHaveBeenCalled();
    });

    it('records a failure when the password is wrong', async () => {
      unlockMock.mockRejectedValueOnce(new Error('invalid password'));
      const handler = getHandler('UNLOCK_WALLET');

      const result = await handler({ password: 'wrong-password' });

      expect(result).toEqual({ success: false });
      expect(unlockMock).toHaveBeenCalledTimes(1);
      expect(saveUnlockAttemptStateMock).toHaveBeenCalledTimes(1);
      expect(clearUnlockAttemptStateMock).not.toHaveBeenCalled();
      expect(persistUnlockSessionMock).not.toHaveBeenCalled();
      expect(setChromeLocalStorageMock).not.toHaveBeenCalled();
    });

    it('unlocks and resets the attempt counter when the password is correct', async () => {
      const handler = getHandler('UNLOCK_WALLET');

      const result = await handler({ password: 'correct-password' });

      expect(result).toEqual({ success: true });
      expect(unlockMock).toHaveBeenCalledTimes(1);
      expect(clearUnlockAttemptStateMock).toHaveBeenCalledTimes(1);
      expect(persistUnlockSessionMock).toHaveBeenCalledTimes(1);
      expect(setChromeLocalStorageMock).toHaveBeenCalledWith(
        expect.objectContaining({ isUnlocked: true }),
      );
      expect(saveUnlockAttemptStateMock).not.toHaveBeenCalled();
    });
  });
});