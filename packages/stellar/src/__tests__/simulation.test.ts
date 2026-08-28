import { rpc, TransactionBuilder, Account, Asset, Operation, Networks } from '@stellar/stellar-sdk';
import { parseSimulationResponse, simulateUnsignedTransaction } from '../simulation';

const SOURCE = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
const DESTINATION = 'GBHHL5543KUJHAWEBZZZIJHQP2EMYY3YPZS2WRJDQ7X6G5HC77625CW7';

function buildFixtureXdr(): string {
  const account = new Account(SOURCE, '123');
  return new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: DESTINATION,
        asset: Asset.native(),
        amount: '1',
      })
    )
    .setTimeout(300)
    .build()
    .toXDR();
}

describe('parseSimulationResponse', () => {
  const fixtureXdr = buildFixtureXdr();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an error result for simulation failures', () => {
    jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(true);
    jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(false);
    jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

    const response: rpc.Api.SimulateTransactionErrorResponse = {
      error: 'HostError: contract trapped',
      id: 'sim-err',
      latestLedger: 100,
      events: [],
    };

    const result = parseSimulationResponse(response, fixtureXdr, Networks.TESTNET);

    expect(result.error).toBe('HostError: contract trapped');
    expect(result.fee).toBe('0.0000000');
    expect(result.authEntries).toEqual([]);
    expect(result.footprint).toBe('');
  });

  it('returns an error result for restore-required simulations', () => {
    jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
    jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(true);
    jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

    const response = {
      id: 'sim-restore',
      latestLedger: 100,
      restorePreamble: {},
    } as rpc.Api.SimulateTransactionRestoreResponse;

    const result = parseSimulationResponse(response, fixtureXdr, Networks.TESTNET);

    expect(result.error).toContain('restored');
    expect(result.authEntries).toEqual([]);
  });

  it('parses successful simulations with fee and resource limits', () => {
    jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
    jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(false);
    jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

    const mockTransactionData = {
      build: () => ({
        resources: () => ({
          instructions: () => 12000,
          readBytes: () => 1024,
          writeBytes: () => 1024,
        }),
        toXDR: () => 'mock-footprint-xdr',
      }),
    };

    const response = {
      id: 'sim-ok',
      latestLedger: 100,
      minResourceFee: '5000',
      result: { auth: [] },
      transactionData: mockTransactionData,
    } as unknown as rpc.Api.SimulateTransactionSuccessResponse;

    const result = parseSimulationResponse(response, fixtureXdr, Networks.TESTNET);

    expect(result.error).toBeUndefined();
    expect(result.fee).toBe('0.0005100');
    expect(result.resourceLimits.cpuInsn).toBe(12000);
    expect(result.resourceLimits.memBytes).toBe(2048);
    expect(result.resourceLimits.minResourceFee).toBe('5000');
    expect(result.authEntries).toEqual([]);
    expect(result.footprint).toBe('mock-footprint-xdr');
  });

  it('estimates classic payment fees without calling Soroban RPC', async () => {
    const rpcSimulate = jest.fn();

    const result = await simulateUnsignedTransaction(fixtureXdr, Networks.TESTNET, rpcSimulate);

    expect(result.error).toBeUndefined();
    expect(result.fee).toBe('0.0000100');
    expect(result.resourceLimits.cpuInsn).toBe(0);
    expect(rpcSimulate).not.toHaveBeenCalled();
  });
});
