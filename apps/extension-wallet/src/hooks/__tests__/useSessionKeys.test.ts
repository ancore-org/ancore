import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSessionKeys } from '../useSessionKeys';
import * as AuthGuard from '@/router/AuthGuard';
import * as sessionKeysStore from '@/stores/sessionKeys';
import * as coreSdk from '@ancore/core-sdk';
import type { SessionKey } from '@ancore/types';
import { SessionPermission } from '@ancore/types';

vi.mock('@/router/AuthGuard');
vi.mock('@/stores/sessionKeys');
vi.mock('@ancore/core-sdk');

describe('useSessionKeys', () => {
  const mockAccountAddress = 'GTEST123456789';
  const mockSessionKey: SessionKey = {
    publicKey: 'GKEY123456789',
    permissions: [SessionPermission.Stellar],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    label: 'Test Key',
  };

  const mockKeys = [mockSessionKey];
  const mockAddKey = vi.fn();
  const mockRemoveKey = vi.fn();
  const mockUpdateKey = vi.fn();
  const mockClientRefreshSessionKeyTtl = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(AuthGuard.useExtensionAuth).mockReturnValue({
      authState: {
        hasOnboarded: true,
        walletName: 'Test Wallet',
        accountAddress: mockAccountAddress,
      },
      unlockError: null,
      isUnlocked: true,
      completeOnboarding: vi.fn(),
      unlockWallet: vi.fn(),
      lockWallet: vi.fn(),
      resetWallet: vi.fn(),
      refreshUnlockStatus: vi.fn(),
    });

    vi.mocked(sessionKeysStore.useSessionKeyStore).mockReturnValue({
      keys: mockKeys,
      addKey: mockAddKey,
      removeKey: mockRemoveKey,
      updateKey: mockUpdateKey,
    } as never);

    const mockClient = {
      refreshSessionKeyTtl: mockClientRefreshSessionKeyTtl,
      addSessionKey: vi.fn(),
      revokeSessionKey: vi.fn(),
    };

    vi.mocked(coreSdk.AncoreClient).mockImplementation(() => mockClient as never);
    vi.mocked(coreSdk.deriveContractId).mockReturnValue('CTEST123456789');
  });

  it('should return initial state with no loading and no error', () => {
    const { result } = renderHook(() => useSessionKeys());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.sessionKeys).toEqual(mockKeys);
  });

  describe('refreshSessionKey', () => {
    it('should optimistically update session key with new expiry', async () => {
      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = mockSessionKey.expiresAt + 86400;

      await act(async () => {
        await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
      });

      expect(mockUpdateKey).toHaveBeenCalledWith(mockSessionKey.publicKey, {
        expiresAt: newExpiresAt,
      });
    });

    it('should call contract refreshSessionKeyTtl with correct parameters', async () => {
      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = mockSessionKey.expiresAt + 86400;

      await act(async () => {
        await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
      });

      expect(mockClientRefreshSessionKeyTtl).toHaveBeenCalledWith({
        publicKey: mockSessionKey.publicKey,
        expiresAt: mockSessionKey.expiresAt,
      });
    });

    it('should rollback optimistic update on contract error', async () => {
      mockClientRefreshSessionKeyTtl.mockImplementationOnce(() => {
        throw new Error('Contract error');
      });

      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = mockSessionKey.expiresAt + 86400;

      await expect(
        act(async () => {
          await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
        })
      ).rejects.toThrow('Contract error');

      expect(mockUpdateKey).toHaveBeenLastCalledWith(mockSessionKey.publicKey, {
        expiresAt: mockSessionKey.expiresAt,
      });
    });

    it('should set error message on contract failure', async () => {
      const errorMessage = 'Failed to refresh TTL on-chain';
      mockClientRefreshSessionKeyTtl.mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });

      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = mockSessionKey.expiresAt + 86400;

      await act(async () => {
        try {
          await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe(errorMessage);
    });

    it('should throw error when session key not found', async () => {
      vi.mocked(sessionKeysStore.useSessionKeyStore).mockReturnValue({
        keys: [],
        addKey: mockAddKey,
        removeKey: mockRemoveKey,
        updateKey: mockUpdateKey,
      } as never);

      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = Math.floor(Date.now() / 1000) + 86400;

      await expect(
        act(async () => {
          await result.current.refreshSessionKey('UNKNOWN_KEY', newExpiresAt);
        })
      ).rejects.toThrow('Session key not found');
    });

    it('should clear previous error when attempting refresh', async () => {
      mockClientRefreshSessionKeyTtl
        .mockImplementationOnce(() => {
          throw new Error('Previous error');
        })
        .mockImplementationOnce(() => undefined);

      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = mockSessionKey.expiresAt + 86400;

      await act(async () => {
        try {
          await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe('Previous error');

      await act(async () => {
        await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
      });

      expect(result.current.error).toBeNull();
    });

    it('should create AncoreClient with correct accountContractId', async () => {
      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = mockSessionKey.expiresAt + 86400;

      await act(async () => {
        await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
      });

      expect(coreSdk.deriveContractId).toHaveBeenCalledWith(mockAccountAddress);
      expect(coreSdk.AncoreClient).toHaveBeenCalledWith({
        accountContractId: 'CTEST123456789',
      });
    });
  });

  describe('clearError', () => {
    it('should clear the error message', async () => {
      mockClientRefreshSessionKeyTtl.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      const { result } = renderHook(() => useSessionKeys());
      const newExpiresAt = mockSessionKey.expiresAt + 86400;

      await act(async () => {
        try {
          await result.current.refreshSessionKey(mockSessionKey.publicKey, newExpiresAt);
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
