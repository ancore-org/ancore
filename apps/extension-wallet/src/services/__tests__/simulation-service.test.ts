import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Account, Asset, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { simulateTransaction } from '../simulation-service';

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

const fixtureXdr = buildFixtureXdr();

describe('simulateTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed simulation data from the injected client', async () => {
    const client = {
      simulateTransaction: vi.fn().mockResolvedValue({
        fee: '0.0000600',
        resourceLimits: { cpuInsn: 12000, memBytes: 2048, minResourceFee: '5000' },
        authEntries: ['auth-entry-xdr'],
        footprint: 'footprint-xdr',
      }),
    };

    const result = await simulateTransaction(fixtureXdr, 'testnet', { client });

    expect(client.simulateTransaction).toHaveBeenCalledWith(fixtureXdr);
    expect(result.error).toBeUndefined();
    expect(result.fee).toBe('0.0000600');
    expect(result.authEntries).toEqual(['auth-entry-xdr']);
    expect(result.footprint).toBe('footprint-xdr');
  });

  it('returns an error payload without throwing when simulation fails', async () => {
    const client = {
      simulateTransaction: vi.fn().mockResolvedValue({
        fee: '0.0000000',
        resourceLimits: { cpuInsn: 0, memBytes: 0 },
        authEntries: [],
        footprint: '',
        error: 'HostError: contract trapped',
      }),
    };

    const result = await simulateTransaction(fixtureXdr, 'testnet', { client });

    expect(result.error).toBe('HostError: contract trapped');
    expect(result.authEntries).toEqual([]);
  });
});

const runIntegration = process.env.RUN_INTEGRATION === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('simulateTransaction integration', () => {
  it('simulateTransaction(fixtureXdr, testnet) returns populated SimulationResult', async () => {
    const result = await simulateTransaction(fixtureXdr, 'testnet');

    expect(result.error).toBeUndefined();
    expect(result.fee).toMatch(/^\d+\.\d{7}$/);
    expect(result.resourceLimits).toBeDefined();
    expect(Array.isArray(result.authEntries)).toBe(true);
    expect(typeof result.footprint).toBe('string');
  });
});
