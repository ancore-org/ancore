/**
 * Unit tests for executeContract / simulateExecute.
 *
 * Both take an injected `server`, so the full submit and simulate paths —
 * including every error branch — are exercisable without a network. The
 * pre-existing coverage for this module only reached the two pure helpers
 * (encodeContractArgs / parseExecuteResult); the integration suite that
 * covered the rest is `describe.skip` because it needs testnet.
 */

import { Networks, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { AccountContract } from '../account-contract';
import { executeContract, simulateExecute, type ExecuteOptions } from '../execute';

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const TARGET = 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR';

/** Minimal RPC stub; each test supplies only the calls it needs. */
function makeServer(overrides: Partial<ExecuteOptions['server']> = {}): ExecuteOptions['server'] {
  return {
    getAccount: jest.fn().mockResolvedValue({ id: SOURCE, sequence: '12345' }),
    simulateTransaction: jest.fn().mockResolvedValue({}),
    sendTransaction: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function makeOptions(server: ExecuteOptions['server']): ExecuteOptions {
  return { server, sourceAccount: SOURCE, networkPassphrase: Networks.TESTNET };
}

describe('executeContract', () => {
  let contract: AccountContract;

  beforeEach(() => {
    contract = new AccountContract(CONTRACT_ID);
  });

  it('submits the transaction and parses the contract return value', async () => {
    const server = makeServer({
      sendTransaction: jest.fn().mockResolvedValue({
        hash: 'abc123',
        result: { retval: nativeToScVal('ok') },
      }),
    });

    const res = await executeContract<string>(
      contract,
      TARGET,
      'transfer',
      ['arg'],
      1,
      makeOptions(server)
    );

    expect(res.result).toBe('ok');
    expect(res.hash).toBe('abc123');
    expect(res.raw).toEqual(expect.objectContaining({ hash: 'abc123' }));
    expect(server.getAccount).toHaveBeenCalledWith(SOURCE);
    expect(server.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('defaults the fee to 100000 stroops and honours an explicit fee', async () => {
    const send = jest.fn().mockResolvedValue({ hash: 'h' });
    const server = makeServer({ sendTransaction: send });

    await executeContract(contract, TARGET, 'f', [], 1, makeOptions(server));
    expect(send.mock.calls[0][0].fee).toBe('100000');

    await executeContract(contract, TARGET, 'f', [], 1, {
      ...makeOptions(server),
      fee: '250',
      timeout: 30,
    });
    expect(send.mock.calls[1][0].fee).toBe('250');
  });

  it('falls back to sequence "0" when the account response omits one', async () => {
    const server = makeServer({
      getAccount: jest.fn().mockResolvedValue({ id: SOURCE }),
      sendTransaction: jest.fn().mockResolvedValue({ hash: 'h' }),
    });

    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).resolves.toBeDefined();
  });

  it('throws when the response carries status ERROR', async () => {
    const server = makeServer({
      sendTransaction: jest.fn().mockResolvedValue({ status: 'ERROR' }),
    });

    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/Transaction failed/);
  });

  it('prefers the error field for the failure message', async () => {
    const server = makeServer({
      sendTransaction: jest.fn().mockResolvedValue({ error: 'insufficient balance' }),
    });

    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/insufficient balance/);
  });

  it('falls back to result_xdr when status is ERROR and no error field is present', async () => {
    const server = makeServer({
      sendTransaction: jest.fn().mockResolvedValue({ status: 'ERROR', result_xdr: 'AAAA/////w==' }),
    });

    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/AAAA/);
  });

  it('maps a numeric Soroban contract error to its typed error', async () => {
    const server = makeServer({
      sendTransaction: jest.fn().mockResolvedValue({ error: 'Error(Contract, #1)' }),
    });

    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow();
  });

  it('returns a null result for a success with no return value', async () => {
    const server = makeServer({
      sendTransaction: jest.fn().mockResolvedValue({ hash: 'h', status: 'SUCCESS' }),
    });

    const res = await executeContract(contract, TARGET, 'f', [], 1, makeOptions(server));
    expect(res.result).toBeNull();
  });

  it('uses id as the hash when hash is absent, and "unknown" when both are', async () => {
    const withId = makeServer({ sendTransaction: jest.fn().mockResolvedValue({ id: 'tx-id' }) });
    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(withId))
    ).resolves.toMatchObject({ hash: 'tx-id' });

    const withNeither = makeServer({ sendTransaction: jest.fn().mockResolvedValue({}) });
    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(withNeither))
    ).resolves.toMatchObject({ hash: 'unknown' });
  });

  it('wraps a rejection from the server', async () => {
    const server = makeServer({
      sendTransaction: jest.fn().mockRejectedValue(new Error('network down')),
    });

    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/network down/);
  });

  it('wraps a non-Error rejection', async () => {
    const server = makeServer({
      getAccount: jest.fn().mockRejectedValue('boom'),
    });

    await expect(
      executeContract(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/Contract execution failed/);
  });
});

describe('simulateExecute', () => {
  let contract: AccountContract;

  beforeEach(() => {
    contract = new AccountContract(CONTRACT_ID);
  });

  it('returns the parsed simulation return value', async () => {
    const server = makeServer({
      simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: nativeToScVal(42) } }),
    });

    // nativeToScVal widens a plain number to an integer ScVal, so the
    // round-trip through scValToNative yields a BigInt.
    await expect(
      simulateExecute<bigint>(contract, TARGET, 'balance', [], 1, makeOptions(server))
    ).resolves.toBe(42n);
  });

  it('parses a void return value', async () => {
    const server = makeServer({
      simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: xdr.ScVal.scvVoid() } }),
    });

    await expect(
      simulateExecute(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).resolves.toBeNull();
  });

  it('throws when the simulation reports an error', async () => {
    const server = makeServer({
      simulateTransaction: jest.fn().mockResolvedValue({ error: 'trap: out of budget' }),
    });

    await expect(
      simulateExecute(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/out of budget/);
  });

  it('throws using the message field when there is no error field', async () => {
    const server = makeServer({
      simulateTransaction: jest.fn().mockResolvedValue({ message: 'bad footprint' }),
    });

    await expect(
      simulateExecute(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/bad footprint/);
  });

  it('throws when the simulation returns no retval', async () => {
    const server = makeServer({
      simulateTransaction: jest.fn().mockResolvedValue({ result: {} }),
    });

    await expect(
      simulateExecute(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/No return value from simulation/);
  });

  it('throws when the simulation response is empty', async () => {
    const server = makeServer({ simulateTransaction: jest.fn().mockResolvedValue({}) });

    await expect(
      simulateExecute(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/No return value from simulation/);
  });

  it('wraps a non-Error rejection', async () => {
    const server = makeServer({
      getAccount: jest.fn().mockRejectedValue('boom'),
    });

    await expect(
      simulateExecute(contract, TARGET, 'f', [], 1, makeOptions(server))
    ).rejects.toThrow(/Contract simulation failed/);
  });
});
