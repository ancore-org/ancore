import type { SessionKey } from '@ancore/types';

export const DEFAULT_SESSION_KEY_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;

export async function refreshSessionKeyTtl(
  key: SessionKey,
  refreshSessionKey: (publicKey: string, newExpiresAt: number) => Promise<void>,
  ttlMs: number = DEFAULT_SESSION_KEY_REFRESH_TTL_MS,
  nowMs: number = Date.now()
): Promise<void> {
  if (key.expiresAt === 0) {
    throw new Error('Cannot refresh a revoked session key');
  }

  await refreshSessionKey(key.publicKey, nowMs + ttlMs);
}
