import type { EncryptedPayload, SessionKeysData, StorageAdapter } from './types';

export const SESSION_KEYS_STORAGE_KEY = 'sessionKeys';

export interface SaveSessionKeysDeps {
  storage: StorageAdapter;
  encryptData: (plaintext: string) => Promise<EncryptedPayload>;
  assertUnlocked: () => void;
  touch?: () => void;
}

/**
 * Encrypt and persist session keys using the caller's unlocked in-memory key flow.
 */
export async function saveSessionKeys(
  sessionKeys: SessionKeysData,
  deps: SaveSessionKeysDeps
): Promise<void> {
  deps.assertUnlocked();
  deps.touch?.();

  const payload = await deps.encryptData(JSON.stringify(sessionKeys));
  await deps.storage.set(SESSION_KEYS_STORAGE_KEY, payload);
}
