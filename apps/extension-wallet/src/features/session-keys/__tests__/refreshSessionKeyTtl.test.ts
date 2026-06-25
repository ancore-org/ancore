import { describe, expect, it, vi } from 'vitest';

import type { SessionKey } from '@ancore/types';
import { SessionPermission } from '@ancore/types';

import {
  DEFAULT_SESSION_KEY_REFRESH_TTL_MS,
  refreshSessionKeyTtl,
} from '../refreshSessionKeyTtl';

const baseKey: SessionKey = {
  publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt: Date.now() + 86_400_000,
  label: 'Trading bot',
};

describe('refreshSessionKeyTtl', () => {
  it('extends expiry by the default TTL', async () => {
    const refreshSessionKey = vi.fn().mockResolvedValue(undefined);
    const nowMs = 1_700_000_000_000;

    await refreshSessionKeyTtl(baseKey, refreshSessionKey, DEFAULT_SESSION_KEY_REFRESH_TTL_MS, nowMs);

    expect(refreshSessionKey).toHaveBeenCalledWith(
      baseKey.publicKey,
      nowMs + DEFAULT_SESSION_KEY_REFRESH_TTL_MS
    );
  });

  it('rejects refresh for revoked keys', async () => {
    const refreshSessionKey = vi.fn();

    await expect(
      refreshSessionKeyTtl({ ...baseKey, expiresAt: 0 }, refreshSessionKey)
    ).rejects.toThrow('Cannot refresh a revoked session key');

    expect(refreshSessionKey).not.toHaveBeenCalled();
  });
});
