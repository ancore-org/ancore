import { Account, Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

import { createVaultSignService } from '../mobile-sign-service';
import { getSigningKeypair } from '../../security/signing-key';

jest.mock('../../security/signing-key', () => ({
  getSigningKeypair: jest.fn(),
}));

jest.mock('@ancore/stellar', () => ({
  createStellarClient: jest.fn(() => ({
    submitTransaction: jest.fn().mockResolvedValue({ hash: 'abc123hash' }),
  })),
}));

describe('createVaultSignService', () => {
  const kp = Keypair.random();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getSigningKeypair).mockResolvedValue(kp);
  });

  it('signs transaction XDR with the vault keypair', async () => {
    const service = createVaultSignService({ network: 'testnet' });
    const unsigned = new TransactionBuilder(new Account(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .setTimeout(0)
      .build()
      .toXDR();

    const result = await service.signTransaction(unsigned);

    expect(result.signedXdr).toBeDefined();
    expect(result.signedXdr).not.toEqual(unsigned);
  });

  it('signs messages as hex', async () => {
    const service = createVaultSignService({ network: 'testnet' });
    const result = await service.signMessage('hello');
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });
});
