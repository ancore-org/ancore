/**
 * Background unlock session state.
 *
 * Freighter pattern: persist hash-key / session metadata in chrome.storage.session
 * so MV3 service worker restarts do not force password re-entry on every click.
 *
 * https://github.com/stellar/freighter/tree/master/extension/src/background
 */

import {
  DEFAULT_UNLOCK_SESSION_TTL_MS,
  UNLOCK_SESSION_STORAGE_KEY,
  isUnlockSessionValid,
  type UnlockSessionRecord,
} from '@ancore/wallet-shared';
import {
  getChromeSessionStorage,
  removeChromeSessionStorage,
  setChromeSessionStorage,
  getChromeLocalStorage,
} from './chrome-storage';

let _sessionUnlocked = false;

export function isBackgroundSessionUnlocked(): boolean {
  return _sessionUnlocked;
}

/**
 * Asynchronously checks if the background session is unlocked.
 * Returns true immediately if the in-memory flag is set.
 * Otherwise attempts to restore the session from chrome.storage.session
 * if a valid unexpired record exists.
 */
export async function isBackgroundSessionUnlockedAsync(): Promise<boolean> {
  if (_sessionUnlocked) {
    return true;
  }
  return restoreUnlockSessionFromStorage();
}

export function setBackgroundSessionUnlocked(unlocked: boolean): void {
  _sessionUnlocked = unlocked;
}

/**
 * Read auto-lock TTL from settings.
 * Returns TTL in milliseconds based on autoLockMinutes setting.
 * If autoLockMinutes is 0 or invalid, returns the default 24h TTL.
 */
async function getAutoLockTtlMs(): Promise<number> {
  try {
    const settingsData = await getChromeLocalStorage('ancore-settings');
    const settings = settingsData as Record<string, unknown> | undefined;
    const autoLockMinutes = settings?.autoLockMinutes as number | undefined;

    if (typeof autoLockMinutes === 'number' && autoLockMinutes > 0) {
      return autoLockMinutes * 60_000; // Convert minutes to milliseconds
    }
  } catch (err) {
    console.warn('[session-state] Failed to read auto-lock settings, using default TTL', err);
  }
  return DEFAULT_UNLOCK_SESSION_TTL_MS;
}

export async function persistUnlockSession(ttlMs?: number): Promise<void> {
  // If TTL not provided, read from settings
  const effectiveTtlMs = ttlMs ?? (await getAutoLockTtlMs());

  const now = Date.now();
  const record: UnlockSessionRecord = {
    unlockedAt: now,
    expiresAt: now + effectiveTtlMs,
  };
  await setChromeSessionStorage(UNLOCK_SESSION_STORAGE_KEY, record);
  _sessionUnlocked = true;
}

export async function clearUnlockSession(): Promise<void> {
  _sessionUnlocked = false;
  await removeChromeSessionStorage(UNLOCK_SESSION_STORAGE_KEY);
}

/**
 * Restore in-memory unlock flag from chrome.storage.session on service worker boot.
 */
export async function restoreUnlockSessionFromStorage(): Promise<boolean> {
  try {
    const raw = await getChromeSessionStorage(UNLOCK_SESSION_STORAGE_KEY);
    if (!raw || typeof raw !== 'object') {
      _sessionUnlocked = false;
      return false;
    }
    const record = raw as UnlockSessionRecord;
    if (!isUnlockSessionValid(record)) {
      await removeChromeSessionStorage(UNLOCK_SESSION_STORAGE_KEY);
      _sessionUnlocked = false;
      return false;
    }
    _sessionUnlocked = true;
    return true;
  } catch {
    _sessionUnlocked = false;
    return false;
  }
}

/**
 * Refresh session expiry when settings change while unlocked.
 * Reads the new auto-lock TTL and updates the session expiration.
 */
export async function refreshSessionExpiry(): Promise<void> {
  if (!_sessionUnlocked) {
    return; // Only refresh if currently unlocked
  }

  const ttlMs = await getAutoLockTtlMs();
  await persistUnlockSession(ttlMs);
}

/**
 * Computes remaining unlock session time in milliseconds from chrome.storage.session.
 */
export async function getRemainingUnlockSessionMs(): Promise<number> {
  try {
    const raw = await getChromeSessionStorage(UNLOCK_SESSION_STORAGE_KEY);
    if (!raw || typeof raw !== 'object') {
      return 0;
    }
    const record = raw as UnlockSessionRecord;
    if (!isUnlockSessionValid(record)) {
      return 0;
    }
    const remaining = record.expiresAt - Date.now();
    return Math.max(0, remaining);
  } catch {
    return 0;
  }
}

/**
 * Formats milliseconds remaining into a user-facing string ('Locks in X minutes').
 */
export function formatRemainingLockTime(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'Locks in 0 minutes';
  }
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (totalMinutes === 1) {
    return 'Locks in 1 minute';
  }
  return `Locks in ${totalMinutes} minutes`;
}
