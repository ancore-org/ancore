import { useState, useCallback } from 'react';
import type { SessionKey } from '@ancore/types';
import { SessionPermission } from '@ancore/types';
import { useSessionKeyStore } from '../stores/sessionKeys';

export { SessionPermission };

export interface AddSessionKeyInput {
  label: string;
  permissions: SessionPermission[];
  expiresAt: number;
}

export interface UseSessionKeysReturn {
  sessionKeys: SessionKey[];
  isLoading: boolean;
  error: string | null;
  addSessionKey: (input: AddSessionKeyInput) => Promise<void>;
  revokeSessionKey: (publicKey: string) => Promise<void>;
  refreshSessionKey: (publicKey: string, newExpiresAt: number) => Promise<void>;
  clearError: () => void;
}

function generateSessionPublicKey(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let key = 'G';
  const bytes = new Uint8Array(55);
  crypto.getRandomValues(bytes);
  for (const b of bytes) key += alphabet[b % alphabet.length];
  return key;
}

export function useSessionKeys(): UseSessionKeysReturn {
  const { keys, addKey, removeKey, updateKey } = useSessionKeyStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const addSessionKey = useCallback(
    async (input: AddSessionKeyInput): Promise<void> => {
      setIsLoading(true);
      setError(null);

      const newKey: SessionKey = {
        publicKey: generateSessionPublicKey(),
        permissions: input.permissions,
        expiresAt: input.expiresAt,
        label: input.label,
      };

      // Optimistic: add immediately so UI responds at once
      addKey(newKey);

      try {
        // TODO: await accountContract.addSessionKey(newKey, serverOptions);
      } catch (err) {
        // Rollback on contract/network failure
        removeKey(newKey.publicKey);
        const msg = err instanceof Error ? err.message : 'Failed to add session key';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addKey, removeKey],
  );

  const revokeSessionKey = useCallback(
    async (publicKey: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      const snapshot = keys.find((k: SessionKey) => k.publicKey === publicKey);

      // Optimistic: remove immediately
      removeKey(publicKey);

      try {
        // TODO: await accountContract.revokeSessionKey(publicKey, serverOptions);
      } catch (err) {
        // Rollback
        if (snapshot) addKey(snapshot);
        const msg = err instanceof Error ? err.message : 'Failed to revoke session key';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [keys, addKey, removeKey],
  );

  const refreshSessionKey = useCallback(
    async (publicKey: string, newExpiresAt: number): Promise<void> => {
      setIsLoading(true);
      setError(null);

      const snapshot = keys.find((k: SessionKey) => k.publicKey === publicKey);

      // Optimistic: update expiry immediately
      updateKey(publicKey, { expiresAt: newExpiresAt });

      try {
        // TODO: await accountContract.refreshSessionKey(publicKey, newExpiresAt, serverOptions);
      } catch (err) {
        // Rollback
        if (snapshot) updateKey(publicKey, { expiresAt: snapshot.expiresAt });
        const msg = err instanceof Error ? err.message : 'Failed to refresh session key';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [keys, updateKey],
  );

  return {
    sessionKeys: keys,
    isLoading,
    error,
    addSessionKey,
    revokeSessionKey,
    refreshSessionKey,
    clearError,
  };
}
