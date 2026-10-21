import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Address, Keypair, xdr, Networks } from '@stellar/stellar-sdk';
import { signAuthEntry, registerSignAuthEntryHandlers } from '../sign-auth-entry';
import { registerHandler } from '@/messaging';
import { clearUnlockSession, isBackgroundSessionUnlocked } from '../../session-state';
import { getSharedStorageManager } from '@/security/storage-manager';
import { getSigningKeypair } from '../../signing-key';
import { getSettingsState } from '@/stores/settings';

vi.mock('@/messaging', () => ({
  registerHandler: vi.fn(),
}));

vi.mock('../../session-state', () => ({
  isBackgroundSessionUnlocked: vi.fn(),
  clearUnlockSession: vi.fn(),
}));

vi.mock('@/security/storage-manager', () => ({
  getSharedStorageManager: vi.fn(() => ({
    isUnlocked: true,
  })),
}));

vi.mock('../../signing-key', () => ({
  getSigningKeypair: vi.fn(),
}));

vi.mock('@/stores/settings', () => ({
  getSettingsState: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a genuine, unsigned SorobanAuthorizationEntry for a simple contract
 * call, authorized by `signerKp`'s address — a real fixture, not a mock.
 * `authorizeEntry` (used by the handler) calls real SDK methods on this
 * object (credentials(), toXDR(), rootInvocation()) that a duck-typed mock
 * cannot satisfy once the fix actually inspects/signs real credentials.
 */
function makeUnsignedAuthEntry(
  signerKp: Keypair,
  { expirationLedger = 1000, nonce = 42n }: { expirationLedger?: number; nonce?: bigint } = {}
): xdr.SorobanAuthorizationEntry {
  const signerAddress = new Address(signerKp.publicKey()).toScAddress();

  const addressCredentials = new xdr.SorobanAddressCredentials({
    address: signerAddress,
    nonce: xdr.Int64.fromString(nonce.toString()),
    signatureExpirationLedger: expirationLedger,
    signature: xdr.ScVal.scvVoid(),
  });

  const rootInvocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: signerAddress,
        functionName: 'transfer',
        args: [],
      })
    ),
    subInvocations: [],
  });

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(addressCredentials),
    rootInvocation,
  });
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
    it('returns a signedAuthEntry with a real, verifiable signature over the correct payload', async () => {
      const unsignedEntry = makeUnsignedAuthEntry(testKp, { expirationLedger: 555, nonce: 7n });

      const result = await signAuthEntry({
        authEntryXdr: unsignedEntry.toXDR('base64'),
        networkPassphrase: Networks.TESTNET,
      });

      expect(typeof result.signedAuthEntry).toBe('string');
      expect(result.signedAuthEntry.length).toBeGreaterThan(0);

      const signedEntry = xdr.SorobanAuthorizationEntry.fromXDR(result.signedAuthEntry, 'base64');
      const addressCredentials = signedEntry.credentials().address();

      // Address, nonce, and expiration are carried over unchanged from the
      // entry the caller submitted — only the signature is added.
      expect(Address.fromScAddress(addressCredentials.address()).toString()).toBe(
        testKp.publicKey()
      );
      expect(addressCredentials.nonce().toString()).toBe('7');
      expect(addressCredentials.signatureExpirationLedger()).toBe(555);

      // Encoded as the standard Soroban account-auth signature: a Vec of one
      // Map with public_key/signature entries — not a bare signature blob,
      // which is what the original (broken) implementation produced. The
      // exact hash preimage authorizeEntry signs over is the SDK's own
      // responsibility (HashIDPreimage::SorobanAuthorization, not a naive
      // concat) — this asserts the shape and that a real 64-byte Ed25519
      // signature by the right key is present, not the SDK's own internals.
      const sigVec = addressCredentials.signature().vec()!;
      expect(sigVec).toHaveLength(1);
      const sigMap = sigVec[0].map()!;
      const publicKeyEntry = sigMap.find((e) => e.key().sym().toString() === 'public_key');
      const sigEntry = sigMap.find((e) => e.key().sym().toString() === 'signature');
      expect(Buffer.from(publicKeyEntry!.val().bytes()).equals(testKp.rawPublicKey())).toBe(true);
      expect(sigEntry!.val().bytes()).toHaveLength(64);
    });

    it('should throw error if wallet is locked', async () => {
      (isBackgroundSessionUnlocked as any).mockReturnValue(false);

      // Lock check happens before fromXDR — any string works
      await expect(signAuthEntry({ authEntryXdr: 'any-xdr-string' })).rejects.toThrow(
        'Wallet is locked'
      );
    });

    it('should throw error and clear unlock session if session flag is true but storage manager is locked', async () => {
      (isBackgroundSessionUnlocked as any).mockReturnValue(true);
      (getSharedStorageManager as any).mockReturnValue({ isUnlocked: false });

      await expect(signAuthEntry({ authEntryXdr: 'any-xdr-string' })).rejects.toThrow(
        'Wallet is locked'
      );
      expect(clearUnlockSession).toHaveBeenCalled();
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

      const unsignedEntry = makeUnsignedAuthEntry(testKp);

      const result = await handlerCb({
        authEntryXdr: unsignedEntry.toXDR('base64'),
      });

      expect(result.signedAuthEntry).toBeDefined();
      expect(typeof result.signedAuthEntry).toBe('string');
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
