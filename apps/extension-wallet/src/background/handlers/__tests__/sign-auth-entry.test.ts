import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, xdr, Networks } from '@stellar/stellar-sdk';
import { signAuthEntry, registerSignAuthEntryHandlers } from '../sign-auth-entry';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlocked } from '../../session-state';
import { getSigningKeypair } from '../../signing-key';
import { getSettingsState } from '@/stores/settings';

vi.mock('@/messaging', () => ({
  registerHandler: vi.fn(),
}));

vi.mock('../../session-state', () => ({
  isBackgroundSessionUnlocked: vi.fn(),
}));

vi.mock('../../signing-key', () => ({
  getSigningKeypair: vi.fn(),
}));

vi.mock('@/stores/settings', () => ({
  getSettingsState: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a mock SorobanAuthorizationEntry that exposes the methods the
 * handler needs (rootInvocation, toXDR). This avoids version-specific
 * XDR constructor issues in tests — the handler's real fromXDR path
 * is exercised by the "invalid XDR" tests.
 */
function mockAuthEntry(entryBytes: Buffer) {
  const rootInvocation = {
    function: vi.fn(),
    subInvocations: vi.fn().mockReturnValue([]),
  };

  return {
    credentials: vi.fn(),
    rootInvocation: vi.fn().mockReturnValue(rootInvocation),
    toXDR: vi.fn().mockReturnValue(entryBytes),
  };
}

describe('sign-auth-entry handler', () => {
  const testKp = Keypair.random();

  beforeEach(() => {
    vi.resetAllMocks();
    (getSettingsState as any).mockReturnValue({ network: 'testnet' });
    (isBackgroundSessionUnlocked as any).mockReturnValue(true);
    (getSigningKeypair as any).mockResolvedValue(testKp);
  });

  describe('signAuthEntry (exported function)', () => {
    it('should return signedAuthEntry on success', async () => {
      // Mock fromXDR to return a minimal entry without depending on
      // SDK union constructors (which vary between versions).
      const entryBytes = Buffer.alloc(32, 0);
      const mockEntry = mockAuthEntry(entryBytes);
      const fromXdrSpy = vi
        .spyOn(xdr.SorobanAuthorizationEntry, 'fromXDR')
        .mockReturnValue(mockEntry as any);

      const result = await signAuthEntry({
        authEntryXdr: Buffer.from('test').toString('base64'),
      });

      expect(result.signedAuthEntry).toBeDefined();
      expect(typeof result.signedAuthEntry).toBe('string');
      expect(result.signedAuthEntry.length).toBeGreaterThan(0);
      expect(fromXdrSpy).toHaveBeenCalled();

      fromXdrSpy.mockRestore();
    });

    it('should throw error if wallet is locked', async () => {
      (isBackgroundSessionUnlocked as any).mockReturnValue(false);

      // Lock check happens before fromXDR — any string works
      await expect(signAuthEntry({ authEntryXdr: 'any-xdr-string' })).rejects.toThrow(
        'Wallet is locked'
      );
    });

    it('should throw error on network mismatch', async () => {
      (isBackgroundSessionUnlocked as any).mockReturnValue(true);

      await expect(
        signAuthEntry({
          authEntryXdr: 'any-xdr-string',
          networkPassphrase: Networks.PUBLIC,
        })
      ).rejects.toThrow('Network passphrase mismatch');
    });

    it('should throw error for invalid XDR (empty string)', async () => {
      await expect(signAuthEntry({ authEntryXdr: '' })).rejects.toThrow('Invalid auth entry XDR');
    });

    it('should throw error for invalid XDR (not base64)', async () => {
      await expect(signAuthEntry({ authEntryXdr: '!!!not-valid-xdr!!!' })).rejects.toThrow(
        'Invalid auth entry XDR'
      );
    });

    it('should throw error for invalid XDR (valid base64 but not SorobanAuthorizationEntry)', async () => {
      const badXdr = Buffer.from('garbage-data').toString('base64');

      await expect(signAuthEntry({ authEntryXdr: badXdr })).rejects.toThrow(
        'Invalid auth entry XDR'
      );
    });
  });

  describe('registerSignAuthEntryHandlers', () => {
    it('should register SIGN_AUTH_ENTRY handler', () => {
      (getSettingsState as any).mockReturnValue({ network: 'testnet' });

      registerSignAuthEntryHandlers();

      expect(registerHandler).toHaveBeenCalledWith('SIGN_AUTH_ENTRY', expect.any(Function));
    });

    it('should return signedAuthEntry via the registered handler', async () => {
      let handlerCb: any;
      (registerHandler as any).mockImplementation((_name: string, cb: any) => {
        handlerCb = cb;
      });

      registerSignAuthEntryHandlers();

      const entryBytes = Buffer.alloc(32, 0);
      const mockEntry = mockAuthEntry(entryBytes);
      const fromXdrSpy = vi
        .spyOn(xdr.SorobanAuthorizationEntry, 'fromXDR')
        .mockReturnValue(mockEntry as any);

      const result = await handlerCb({
        authEntryXdr: Buffer.from('test').toString('base64'),
      });

      expect(result.signedAuthEntry).toBeDefined();
      expect(typeof result.signedAuthEntry).toBe('string');

      fromXdrSpy.mockRestore();
    });

    it('should throw via the registered handler when wallet is locked', async () => {
      let handlerCb: any;
      (registerHandler as any).mockImplementation((_name: string, cb: any) => {
        handlerCb = cb;
      });

      registerSignAuthEntryHandlers();
      (isBackgroundSessionUnlocked as any).mockReturnValue(false);

      // Lock check happens before fromXDR — any string works
      await expect(handlerCb({ authEntryXdr: 'any-xdr-string' })).rejects.toThrow(
        'Wallet is locked'
      );
    });
  });
});
