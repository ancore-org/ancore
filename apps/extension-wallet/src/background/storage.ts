/**
 * background/storage.ts
 *
 * Background-context entry point for the SecureStorageManager singleton.
 *
 * The actual singleton lives in `@/security/storage-manager` so it can be
 * shared across the security module and the background handlers without
 * creating multiple instances.  This file is the canonical import path for
 * background service-worker code; it re-exports everything the background
 * needs so callers only have to import from one place.
 *
 * Security note: the SecureStorageManager holds the derived CryptoKey
 * in memory only for the duration of the active session.  Calling lock()
 * (or waiting for the auto-lock timeout) clears the key from memory.
 * The raw password and key material are never persisted.
 *
 * Usage in a background handler:
 *
 *   import { getStorageManager } from '@/background/storage';
 *
 *   const manager = getStorageManager();
 *   const unlocked = await manager.unlock(password);
 *   if (unlocked) {
 *     const account = await manager.getAccount();
 *   }
 */

export {
  getSharedStorageManager as getStorageManager,
  resetSharedStorageManagerForTests,
} from '@/security/storage-manager';
