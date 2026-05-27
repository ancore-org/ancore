import { TransactionBuilder, Keypair, Networks, Operation, Asset, Account } from '@stellar/stellar-sdk';
import { StellarClient, NetworkError } from '@ancore/stellar';
import { StellarTransactionSubmitter } from '../../src/services/stellarSubmitter';

jest.mock('@ancore/stellar', () => {
  const actual = jest.requireActual('@ancore/stellar');
  return {
    ...actual,
    StellarClient: jest.fn(),
  };
});

const MockStellarClient = StellarClient as jest.MockedClass<typeof StellarClient>;

function buildSignedTransactionXdr(): string {
  const source = new Account(Keypair.random().publicKey(), '1');
  const tx = new TransactionBuilder(source, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: '1',
      })
    )
    .setTimeout(300)
    .build();

  const keypair = Keypair.random();
  tx.sign(keypair);
  return tx.toXDR();
}

describe('StellarTransactionSubmitter', () => {
  beforeEach(() => {
    MockStellarClient.mockClear();
  });

  it('submits a signed transaction and returns hash and fee', async () => {
    const submitTransaction = jest.fn().mockResolvedValue({
      hash: 'a'.repeat(64),
    });
    const isHealthy = jest.fn().mockResolvedValue(true);
    MockStellarClient.mockImplementation(
      () => ({ submitTransaction, isHealthy }) as unknown as StellarClient
    );

    const submitter = new StellarTransactionSubmitter({ network: 'testnet' });
    const signedXdr = buildSignedTransactionXdr();
    const result = await submitter.submitSignedTransaction(signedXdr);

    expect(submitTransaction).toHaveBeenCalledTimes(1);
    expect(result.transactionHash).toBe('a'.repeat(64));
    expect(result.gasUsed).toBe(100);
  });

  it('propagates submission errors from StellarClient', async () => {
    const submitTransaction = jest.fn().mockRejectedValue(new NetworkError('submit failed'));
    MockStellarClient.mockImplementation(
      () => ({ submitTransaction, isHealthy: jest.fn() }) as unknown as StellarClient
    );

    const submitter = new StellarTransactionSubmitter({ network: 'testnet' });
    await expect(submitter.submitSignedTransaction(buildSignedTransactionXdr())).rejects.toThrow(
      NetworkError
    );
  });

  it('reports RPC health with latency', async () => {
    const isHealthy = jest.fn().mockResolvedValue(true);
    MockStellarClient.mockImplementation(
      () => ({ submitTransaction: jest.fn(), isHealthy }) as unknown as StellarClient
    );

    const submitter = new StellarTransactionSubmitter({ network: 'testnet' });
    const result = await submitter.isHealthy();

    expect(result.healthy).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
  });
});
