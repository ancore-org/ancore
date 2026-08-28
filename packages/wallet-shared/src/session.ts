/** chrome.storage.session key for background unlock session metadata. */
export const UNLOCK_SESSION_STORAGE_KEY = 'ancore_unlock_session';

/** Default session TTL when auto-lock is disabled or not yet read from settings (24h, Freighter default). */
export const DEFAULT_UNLOCK_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface UnlockSessionRecord {
  unlockedAt: number;
  expiresAt: number;
}

export function isUnlockSessionValid(
  record: UnlockSessionRecord | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!record) return false;
  return typeof record.expiresAt === 'number' && record.expiresAt > nowMs;
}
