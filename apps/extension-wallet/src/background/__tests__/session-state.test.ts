/**
 * Session state unit tests.
 *
 * Tests session persistence, TTL calculation from settings, and session expiry refresh.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isBackgroundSessionUnlocked,
  setBackgroundSessionUnlocked,
  persistUnlockSession,
  clearUnlockSession,
  restoreUnlockSessionFromStorage,
  refreshSessionExpiry,
} from '../session-state';
import { DEFAULT_UNLOCK_SESSION_TTL_MS } from '@ancore/wallet-shared';
import * as chromeStorage from '../chrome-storage';

// Mock chrome-storage module
vi.mock('../chrome-storage');

const mockSessionStorage: Record<string, unknown> = {};

beforeEach(() => {
  vi.clearAllMocks();
  // Clear mock storage
  Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
  // Reset session state
  setBackgroundSessionUnlocked(false);

  // Setup chrome-storage mocks
  vi.mocked(chromeStorage.getChromeSessionStorage).mockImplementation(async (key: string) => {
    return mockSessionStorage[key] ?? null;
  });

  vi.mocked(chromeStorage.setChromeSessionStorage).mockImplementation(
    async (key: string, value: unknown) => {
      mockSessionStorage[key] = value;
    }
  );

  vi.mocked(chromeStorage.removeChromeSessionStorage).mockImplementation(async (key: string) => {
    delete mockSessionStorage[key];
  });

  vi.mocked(chromeStorage.getChromeLocalStorage).mockImplementation(async () => {
    return null;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session state persistence', () => {
  it('sets background session unlocked flag', () => {
    setBackgroundSessionUnlocked(true);
    expect(isBackgroundSessionUnlocked()).toBe(true);

    setBackgroundSessionUnlocked(false);
    expect(isBackgroundSessionUnlocked()).toBe(false);
  });

  it('persists unlock session with default TTL when no settings available', async () => {
    const now = Date.now();
    await persistUnlockSession();

    expect(chromeStorage.setChromeSessionStorage).toHaveBeenCalled();
    const setCall = vi.mocked(chromeStorage.setChromeSessionStorage).mock.calls[0];
    const record = setCall[1] as { unlockedAt: number; expiresAt: number };

    expect(record.unlockedAt).toBeGreaterThanOrEqual(now);
    expect(record.expiresAt).toBe(record.unlockedAt + DEFAULT_UNLOCK_SESSION_TTL_MS);
    expect(isBackgroundSessionUnlocked()).toBe(true);
  });

  it('persists unlock session with custom TTL when provided', async () => {
    const customTtl = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    await persistUnlockSession(customTtl);

    expect(chromeStorage.setChromeSessionStorage).toHaveBeenCalled();
    const setCall = vi.mocked(chromeStorage.setChromeSessionStorage).mock.calls[0];
    const record = setCall[1] as { unlockedAt: number; expiresAt: number };

    expect(record.expiresAt).toBe(record.unlockedAt + customTtl);
  });

  it('reads auto-lock TTL from settings when not provided', async () => {
    // Set up settings with 15 minute auto-lock
    vi.mocked(chromeStorage.getChromeLocalStorage).mockResolvedValueOnce({
      autoLockMinutes: 15,
    });

    const now = Date.now();
    await persistUnlockSession();

    expect(chromeStorage.setChromeSessionStorage).toHaveBeenCalled();
    const setCall = vi.mocked(chromeStorage.setChromeSessionStorage).mock.calls[0];
    const record = setCall[1] as { unlockedAt: number; expiresAt: number };

    expect(record.expiresAt).toBe(record.unlockedAt + 15 * 60 * 1000);
  });

  it('uses default TTL when auto-lock minutes is 0', async () => {
    vi.mocked(chromeStorage.getChromeLocalStorage).mockResolvedValueOnce({
      autoLockMinutes: 0,
    });

    await persistUnlockSession();

    const setCall = vi.mocked(chromeStorage.setChromeSessionStorage).mock.calls[0];
    const record = setCall[1] as { unlockedAt: number; expiresAt: number };

    expect(record.expiresAt).toBe(record.unlockedAt + DEFAULT_UNLOCK_SESSION_TTL_MS);
  });

  it('uses default TTL when settings are invalid', async () => {
    vi.mocked(chromeStorage.getChromeLocalStorage).mockResolvedValueOnce({
      autoLockMinutes: 'invalid' as unknown as number,
    });

    await persistUnlockSession();

    const setCall = vi.mocked(chromeStorage.setChromeSessionStorage).mock.calls[0];
    const record = setCall[1] as { unlockedAt: number; expiresAt: number };

    expect(record.expiresAt).toBe(record.unlockedAt + DEFAULT_UNLOCK_SESSION_TTL_MS);
  });

  it('clears unlock session and resets flag', async () => {
    setBackgroundSessionUnlocked(true);
    mockSessionStorage['ancore_unlock_session'] = {
      unlockedAt: Date.now(),
      expiresAt: Date.now() + 100000,
    };

    await clearUnlockSession();

    expect(chromeStorage.removeChromeSessionStorage).toHaveBeenCalledWith('ancore_unlock_session');
    expect(isBackgroundSessionUnlocked()).toBe(false);
    expect(mockSessionStorage['ancore_unlock_session']).toBeUndefined();
  });
});

describe('session restore from storage', () => {
  it('restores session when valid record exists', async () => {
    const now = Date.now();
    mockSessionStorage['ancore_unlock_session'] = {
      unlockedAt: now,
      expiresAt: now + 100000, // 100 seconds in future
    };

    const restored = await restoreUnlockSessionFromStorage();

    expect(restored).toBe(true);
    expect(isBackgroundSessionUnlocked()).toBe(true);
  });

  it('does not restore session when no record exists', async () => {
    const restored = await restoreUnlockSessionFromStorage();

    expect(restored).toBe(false);
    expect(isBackgroundSessionUnlocked()).toBe(false);
  });

  it('does not restore session when record is expired', async () => {
    const now = Date.now();
    mockSessionStorage['ancore_unlock_session'] = {
      unlockedAt: now - 200000,
      expiresAt: now - 100000, // expired 100 seconds ago
    };

    const restored = await restoreUnlockSessionFromStorage();

    expect(restored).toBe(false);
    expect(isBackgroundSessionUnlocked()).toBe(false);
    expect(chromeStorage.removeChromeSessionStorage).toHaveBeenCalledWith('ancore_unlock_session');
  });

  it('does not restore session when record is malformed', async () => {
    mockSessionStorage['ancore_unlock_session'] = { invalid: 'data' };

    const restored = await restoreUnlockSessionFromStorage();

    expect(restored).toBe(false);
    expect(isBackgroundSessionUnlocked()).toBe(false);
  });

  it('handles storage errors gracefully', async () => {
    vi.mocked(chromeStorage.getChromeSessionStorage).mockImplementation(async () => {
      throw new Error('Storage error');
    });

    const restored = await restoreUnlockSessionFromStorage();

    expect(restored).toBe(false);
    expect(isBackgroundSessionUnlocked()).toBe(false);
  });
});

describe('session expiry refresh', () => {
  it('refreshes session expiry when currently unlocked', async () => {
    setBackgroundSessionUnlocked(true);
    vi.mocked(chromeStorage.getChromeLocalStorage).mockResolvedValueOnce({
      autoLockMinutes: 10,
    });

    await refreshSessionExpiry();

    expect(chromeStorage.setChromeSessionStorage).toHaveBeenCalled();
    const setCall = vi.mocked(chromeStorage.setChromeSessionStorage).mock.calls[0];
    const record = setCall[1] as { unlockedAt: number; expiresAt: number };

    expect(record.expiresAt).toBe(record.unlockedAt + 10 * 60 * 1000);
  });

  it('does not refresh session when currently locked', async () => {
    setBackgroundSessionUnlocked(false);
    vi.mocked(chromeStorage.getChromeLocalStorage).mockResolvedValueOnce({
      autoLockMinutes: 10,
    });

    await refreshSessionExpiry();

    expect(chromeStorage.setChromeSessionStorage).not.toHaveBeenCalled();
  });

  it('reads new TTL from settings when refreshing', async () => {
    setBackgroundSessionUnlocked(true);
    // Change from 15 to 5 minutes
    vi.mocked(chromeStorage.getChromeLocalStorage).mockResolvedValueOnce({
      autoLockMinutes: 5,
    });

    await refreshSessionExpiry();

    const setCall = vi.mocked(chromeStorage.setChromeSessionStorage).mock.calls[0];
    const record = setCall[1] as { unlockedAt: number; expiresAt: number };

    expect(record.expiresAt).toBe(record.unlockedAt + 5 * 60 * 1000);
  });
});
