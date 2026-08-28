import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { buildRelayCanonicalPayload } from '@ancore/core-sdk';
import { signRelayPayload, registerSignRelayPayloadHandlers } from '../sign-relay-payload';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlocked } from '../../session-state';
import { getSigningKeypair } from '../../signing-key';

vi.mock('@/messaging', () => ({
  registerHandler: vi.fn(),
}));

vi.mock('../../session-state', () => ({
  isBackgroundSessionUnlocked: vi.fn(),
}));

vi.mock('../../signing-key', () => ({
  getSigningKeypair: vi.fn(),
}));

describe('sign-relay-payload handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects an invalid operation', async () => {
    await expect(signRelayPayload({ operation: '', nonce: 1 })).rejects.toThrow(
      'Invalid operation'
    );
  });

  it('rejects a non-numeric nonce', async () => {
    await expect(signRelayPayload({ operation: 'relay_execute', nonce: NaN })).rejects.toThrow(
      'Invalid nonce'
    );
  });

  it('throws when the wallet is locked', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(false);

    await expect(signRelayPayload({ operation: 'relay_execute', nonce: 1 })).rejects.toThrow(
      'Wallet is locked'
    );
  });

  it('returns a sessionKey/signature that pass the same canonical-payload verification the relayer performs', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(true);
    const kp = Keypair.random();
    (getSigningKeypair as any).mockResolvedValue(kp);

    const result = await signRelayPayload({ operation: 'relay_execute', nonce: 42 });

    expect(result.sessionKey).toMatch(/^[0-9a-f]{64}$/);
    expect(result.signature).toMatch(/^[0-9a-f]{128}$/);

    // sessionKey must be the real hex-encoded raw public key of the signer.
    expect(result.sessionKey).toBe(Buffer.from(kp.rawPublicKey()).toString('hex'));

    // Re-derive the exact canonical payload and verify with the same
    // Ed25519 primitive the relayer's Ed25519SignatureService uses.
    const canonicalPayload = buildRelayCanonicalPayload({
      sessionKey: result.sessionKey,
      operation: 'relay_execute',
      nonce: 42,
    });
    const verifierKp = Keypair.fromPublicKey(kp.publicKey());
    expect(
      verifierKp.verify(Buffer.from(canonicalPayload, 'utf8'), Buffer.from(result.signature, 'hex'))
    ).toBe(true);
  });

  it('produces a signature that fails verification for a different nonce (no fake/reusable signature)', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(true);
    const kp = Keypair.random();
    (getSigningKeypair as any).mockResolvedValue(kp);

    const result = await signRelayPayload({ operation: 'relay_execute', nonce: 1 });
    const tamperedPayload = buildRelayCanonicalPayload({
      sessionKey: result.sessionKey,
      operation: 'relay_execute',
      nonce: 2,
    });

    expect(
      kp.verify(Buffer.from(tamperedPayload, 'utf8'), Buffer.from(result.signature, 'hex'))
    ).toBe(false);
  });

  describe('registerSignRelayPayloadHandlers', () => {
    it('registers a SIGN_RELAY_PAYLOAD handler that delegates to signRelayPayload', async () => {
      (isBackgroundSessionUnlocked as any).mockReturnValue(true);
      const kp = Keypair.random();
      (getSigningKeypair as any).mockResolvedValue(kp);

      registerSignRelayPayloadHandlers();

      expect(registerHandler).toHaveBeenCalledWith('SIGN_RELAY_PAYLOAD', expect.any(Function));
      const handlerCb = (registerHandler as any).mock.calls[0][1];
      const result = await handlerCb({ operation: 'relay_execute', nonce: 7 });
      expect(result.sessionKey).toMatch(/^[0-9a-f]{64}$/);
      expect(result.signature).toMatch(/^[0-9a-f]{128}$/);
    });
  });
});
