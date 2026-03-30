import type { EncryptedPayload, SessionKeysData, StorageAdapter } from './types';
import { SESSION_KEYS_STORAGE_KEY } from './save-session-keys';

export interface GetSessionKeysDeps {
  storage: StorageAdapter;
  decryptData: (payload: EncryptedPayload) => Promise<string>;
  assertUnlocked: () => void;
  touch?: () => void;
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.salt === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.data === 'string'
  );
}

function isSessionKeysData(value: unknown): value is SessionKeysData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Record<string, unknown>;
  if (!('keys' in data) || !data.keys || typeof data.keys !== 'object') {
    return false;
  }

  for (const item of Object.values(data.keys as Record<string, unknown>)) {
    if (typeof item !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Load and decrypt persisted session keys.
 * Returns an empty typed object when no payload exists.
 */
export async function getSessionKeys(deps: GetSessionKeysDeps): Promise<SessionKeysData> {
  deps.assertUnlocked();
  deps.touch?.();

  const payload = (await deps.storage.get(SESSION_KEYS_STORAGE_KEY)) as unknown;
  if (payload === null) {
    return { keys: {} };
  }

  if (!isEncryptedPayload(payload)) {
    throw new Error('Invalid password or corrupted data');
  }

  try {
    const json = await deps.decryptData(payload);
    const parsed = JSON.parse(json) as unknown;

    if (!isSessionKeysData(parsed)) {
      throw new Error('Invalid password or corrupted data');
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid password or corrupted data') {
      throw error;
    }
    throw new Error('Invalid password or corrupted data');
  }
}
