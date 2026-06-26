import { useState, useCallback } from 'react';
import type { SessionKey } from '@ancore/types';
import { SessionPermission } from '@ancore/types';
import { AncoreClient, deriveContractId } from '@ancore/core-sdk';
import { useExtensionAuth } from '@/router/AuthGuard';
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

function createAccountClient(accountAddress: string) {
  const accountContractId = deriveContractId(accountAddress);
  return new AncoreClient({ accountContractId });
}

export function useSessionKeys(): UseSessionKeysReturn {
  const { authState } = useExtensionAuth();
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

      addKey(newKey);

      try {
        const client = createAccountClient(authState.accountAddress);
        client.addSessionKey({
          publicKey: newKey.publicKey,
          permissions: newKey.permissions,
          expiresAt: newKey.expiresAt,
        });
      } catch (err) {
        removeKey(newKey.publicKey);
        const msg = err instanceof Error ? err.message : 'Failed to add session key';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addKey, authState.accountAddress, removeKey]
  );

  const revokeSessionKey = useCallback(
    async (publicKey: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      const snapshot = keys.find((k: SessionKey) => k.publicKey === publicKey);
      removeKey(publicKey);

      try {
        const client = createAccountClient(authState.accountAddress);
        client.revokeSessionKey({ publicKey });
      } catch (err) {
        if (snapshot) addKey(snapshot);
        const msg = err instanceof Error ? err.message : 'Failed to revoke session key';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addKey, authState.accountAddress, keys, removeKey]
  );

  const refreshSessionKey = useCallback(
    async (publicKey: string, newExpiresAt: number): Promise<void> => {
      setError(null);

      const snapshot = keys.find((k: SessionKey) => k.publicKey === publicKey);
      updateKey(publicKey, { expiresAt: newExpiresAt });

      try {
        // Contract refresh semantics are not yet implemented in AccountContract.
        // Persist local expiry updates optimistically and roll back on failure.
        if (!snapshot) {
          throw new Error('Session key not found');
        }
      } catch (err) {
        if (snapshot) updateKey(publicKey, { expiresAt: snapshot.expiresAt });
        const msg = err instanceof Error ? err.message : 'Failed to refresh session key';
        setError(msg);
        throw err;
      }
    },
    [keys, updateKey]
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
