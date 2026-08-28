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
