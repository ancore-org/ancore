import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, TransactionBuilder, Networks, Account } from '@stellar/stellar-sdk';
import { registerSignTransactionHandlers } from '../sign-transaction';
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

describe('sign-transaction handler', () => {
  let handlerCb: any;

  beforeEach(() => {
    vi.resetAllMocks();
    (getSettingsState as any).mockReturnValue({ network: 'testnet' });

    registerSignTransactionHandlers();
    handlerCb = (registerHandler as any).mock.calls[0][1];
  });

  it('should throw error if wallet is locked', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(false);

    await expect(handlerCb({ xdr: 'xdr-string' })).rejects.toThrow('Wallet is locked');
  });

  it('should throw error on network mismatch', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(true);

    await expect(
      handlerCb({ xdr: 'xdr-string', networkPassphrase: Networks.PUBLIC })
    ).rejects.toThrow('Network passphrase mismatch');
  });

  it('should return signed XDR on success', async () => {
    (isBackgroundSessionUnlocked as any).mockReturnValue(true);

    const kp = Keypair.random();
    (getSigningKeypair as any).mockResolvedValue(kp);

    const tx = new TransactionBuilder(new Account(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .setTimeout(0)
      .build();

    const xdr = tx.toXDR();

    const result = await handlerCb({ xdr, networkPassphrase: Networks.TESTNET });

    expect(result.error).toBeUndefined();
    expect(result.signedXdr).toBeDefined();
    expect(result.signedXdr).not.toEqual(xdr);
  });
});
