import {
  TransactionBuilder,
  Keypair,
  Networks,
  Operation,
  Asset,
  Account,
  rpc,
} from '@stellar/stellar-sdk';
import { StellarClient, NetworkError, SimulationFailedError } from '@ancore/stellar';
import {
  StellarTransactionSubmitter,
  resolveStellarNetwork,
} from '../../src/services/stellarSubmitter';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      assembleTransaction: jest.fn(() => ({
        build: () => ({
          toXDR: () => 'AAAA-assembled-xdr',
          fee: '250',
        }),
      })),
    },
  };
});

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

  it('simulates, assembles, and returns prepared XDR with fee', async () => {
    const signedXdr = buildSignedTransactionXdr();
    const simulateTransaction = jest.fn().mockResolvedValue({
      id: 'sim-1',
      latestLedger: 1,
      events: [],
      _parsed: true,
      transactionData: {},
      minResourceFee: '250',
      cost: { cpuInsns: '0', memBytes: '0' },
      results: [],
    });
    const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(true);
    const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
    const isRestoreSpy = jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(false);

    MockStellarClient.mockImplementation(
      () => ({ simulateTransaction, isHealthy: jest.fn() }) as unknown as StellarClient
    );

    const submitter = new StellarTransactionSubmitter({ network: 'testnet' });
    const result = await submitter.simulateAndAssembleTransaction(signedXdr);

    expect(simulateTransaction).toHaveBeenCalledTimes(1);
    expect(result.assembledXdr).toBe('AAAA-assembled-xdr');
    expect(result.gasUsed).toBe(250);

    isSuccessSpy.mockRestore();
    isErrorSpy.mockRestore();
    isRestoreSpy.mockRestore();
  });

  it('throws SimulationFailedError when simulation reports an error', async () => {
    const simulateTransaction = jest.fn().mockResolvedValue({
      error: 'host invocation failed',
      events: [],
      id: 'sim-err',
      latestLedger: 1,
    });
    jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(true);

    MockStellarClient.mockImplementation(
      () => ({ simulateTransaction, isHealthy: jest.fn() }) as unknown as StellarClient
    );

    const submitter = new StellarTransactionSubmitter({ network: 'testnet' });
    await expect(
      submitter.simulateAndAssembleTransaction(buildSignedTransactionXdr())
    ).rejects.toThrow(SimulationFailedError);
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

  it('uses the Futurenet passphrase when constructing the Stellar client', () => {
    MockStellarClient.mockImplementation(
      () =>
        ({
          submitTransaction: jest.fn(),
          isHealthy: jest.fn(),
        }) as unknown as StellarClient
    );

    new StellarTransactionSubmitter({ network: 'futurenet' });

    expect(MockStellarClient).toHaveBeenCalledWith({
      network: 'futurenet',
      networkPassphrase: 'Test SDF Future Network ; October 2022',
    });
  });

  it('resolves futurenet from environment input', () => {
    expect(resolveStellarNetwork('futurenet')).toBe('futurenet');
    expect(resolveStellarNetwork('unknown')).toBe('testnet');
  });
});
