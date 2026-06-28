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
} from './chrome-storage';

let _sessionUnlocked = false;

export function isBackgroundSessionUnlocked(): boolean {
  return _sessionUnlocked;
}

export function setBackgroundSessionUnlocked(unlocked: boolean): void {
  _sessionUnlocked = unlocked;
}

export async function persistUnlockSession(
  ttlMs: number = DEFAULT_UNLOCK_SESSION_TTL_MS
): Promise<void> {
  const now = Date.now();
  const record: UnlockSessionRecord = {
    unlockedAt: now,
    expiresAt: now + ttlMs,
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
