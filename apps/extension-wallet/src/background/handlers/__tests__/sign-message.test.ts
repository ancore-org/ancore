import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { signMessage, registerSignMessageHandlers } from '../sign-message';
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

describe('sign-message handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects an empty message', async () => {
    await expect(signMessage({ message: '' })).rejects.toThrow('Invalid message');
  });

  it('throws when the wallet is locked', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(false);

    await expect(signMessage({ message: 'hello' })).rejects.toThrow('Wallet is locked');
  });

  it('returns a real, verifiable Ed25519 signature over the raw message bytes', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(true);
    const kp = Keypair.random();
    (getSigningKeypair as any).mockResolvedValue(kp);

    const message = '7b2273657373696f6e4b6579223a22307839227d';
    const result = await signMessage({ message });

    expect(result.signature).toMatch(/^[0-9a-f]{128}$/);

    const sigBytes = Buffer.from(result.signature, 'hex');
    const msgBytes = Buffer.from(message, 'utf8');
    expect(kp.verify(msgBytes, sigBytes)).toBe(true);
  });

  it('produces a signature that fails verification against a different message', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(true);
    const kp = Keypair.random();
    (getSigningKeypair as any).mockResolvedValue(kp);

    const result = await signMessage({ message: 'real-payload' });
    const sigBytes = Buffer.from(result.signature, 'hex');

    expect(kp.verify(Buffer.from('tampered-payload', 'utf8'), sigBytes)).toBe(false);
  });

  describe('registerSignMessageHandlers', () => {
    it('registers a SIGN_MESSAGE handler that delegates to signMessage', async () => {
      (isBackgroundSessionUnlocked as any).mockReturnValue(true);
      const kp = Keypair.random();
      (getSigningKeypair as any).mockResolvedValue(kp);

      registerSignMessageHandlers();

      expect(registerHandler).toHaveBeenCalledWith('SIGN_MESSAGE', expect.any(Function));
      const handlerCb = (registerHandler as any).mock.calls[0][1];
      const result = await handlerCb({ message: 'ping' });
      expect(result.signature).toMatch(/^[0-9a-f]{128}$/);
    });
  });
});
