/**
 * Encoding and transaction-lifecycle tests for `AccountTransactionBuilder`
 * and `contract-params` (#1354).
 *
 * # Why this file exists alongside `builder.test.ts`
 *
 * #1354 reported that this path had "zero test coverage", on the evidence that
 * `find packages/core-sdk -iname "*account-transaction-builder*"` returned only
 * the source file. The coverage was there — in `builder.test.ts`, which the
 * glob does not match — and it reports 100% of statements, branches, functions
 * and lines for both files.
 *
 * But 100% line coverage is not the same as 100% behavioural coverage, and the
 * specific failure #1354 is worried about — "a wrong ScVal type for a
 * permission bitmask" — is one the existing suite genuinely cannot catch. Its
 * happy-path assertions are `expect(result).toBeDefined()`: change `toScU32`
 * to emit a `u64`, or `toScPermissionsVec` to reverse its input, and every one
 * of them still passes while every transaction built through this path is
 * corrupt.
 *
 * So this file asserts what the values actually encode to — discriminant and
 * decoded contents, on both sides of every boundary — rather than that a value
 * exists. It is named to match the search that produced the ticket, so the
 * next person looking finds it.
 *
 * Writing it surfaced two real defects in the code under test, both now fixed
 * and pinned below: `simulate()` followed by `build()` consumed two sequence
 * numbers, and `toScU64` silently encoded values past
 * `Number.MAX_SAFE_INTEGER`.
 */

import {
  Account,
  Keypair,
  Memo,
  Networks,
  Operation,
  rpc,
  StrKey,
  xdr,
} from '@stellar/stellar-sdk';

import { AccountTransactionBuilder } from '../account-transaction-builder';
import {
  toScAddress,
  toScOperationsVec,
  toScPermissionsVec,
  toScU32,
  toScU64,
} from '../contract-params';
import { SimulationExpiredError, SimulationFailedError } from '../errors';

const SOURCE_KEYPAIR = Keypair.random();
const SESSION_KEYPAIR = Keypair.random();
const CONTRACT_ID = StrKey.encodeContract(require('crypto').randomBytes(32));

const STARTING_SEQUENCE = '100';

function makeSourceAccount(sequence = STARTING_SEQUENCE): Account {
  return new Account(SOURCE_KEYPAIR.publicKey(), sequence);
}

function makeBuilder(server: rpc.Server, sourceAccount = makeSourceAccount()) {
  return {
    builder: new AccountTransactionBuilder(sourceAccount, {
      server,
      accountContractId: CONTRACT_ID,
      networkPassphrase: Networks.TESTNET,
    }),
    sourceAccount,
  };
}

function makeOperation(value = 'val'): xdr.Operation {
  return Operation.manageData({ name: 'test', value });
}

/** A server whose simulation always fails — enough to drive `simulate()`. */
function makeFailingServer() {
  return {
    simulateTransaction: jest.fn().mockResolvedValue({ error: 'contract would revert' }),
  } as unknown as rpc.Server;
}

// ===========================================================================
// contract-params — what the values actually encode to
// ===========================================================================

describe('contract-params encoding (#1354)', () => {
  describe('toScU32', () => {
    it('encodes as scvU32, not some other integer width', () => {
      const encoded = toScU32(1000);

      expect(encoded.switch().name).toBe('scvU32');
      expect(encoded.u32()).toBe(1000);
    });

    it('round-trips both ends of the u32 range', () => {
      expect(toScU32(0).u32()).toBe(0);
      expect(toScU32(0xffff_ffff).u32()).toBe(0xffff_ffff);
    });

    it('rejects the first value past the top of the range', () => {
      expect(() => toScU32(0x1_0000_0000)).toThrow(/Invalid u32 value/);
    });
  });

  describe('toScU64', () => {
    it('encodes as scvU64 with the exact value', () => {
      const encoded = toScU64(1_800_000_000);

      expect(encoded.switch().name).toBe('scvU64');
      expect(encoded.u64().toString()).toBe('1800000000');
    });

    it('accepts the largest exactly-representable integer', () => {
      const encoded = toScU64(Number.MAX_SAFE_INTEGER);

      expect(encoded.u64().toString()).toBe(String(Number.MAX_SAFE_INTEGER));
    });

    /**
     * `Number.isInteger(2 ** 53)` is true, so the original range check let
     * these through. The number has already lost precision by then, so the
     * encoded u64 is not the one the caller asked for — it just cannot be
     * observed from the JavaScript side.
     */
    it('rejects values beyond safe integer precision rather than encoding a different number', () => {
      expect(() => toScU64(Number.MAX_SAFE_INTEGER + 2)).toThrow(/MAX_SAFE_INTEGER/);
      expect(() => toScU64(2 ** 64)).toThrow(/MAX_SAFE_INTEGER/);
    });
  });

  describe('toScPermissionsVec', () => {
    it('encodes a vec of u32 values, preserving order', () => {
      const encoded = toScPermissionsVec([2, 0, 1]);

      expect(encoded.switch().name).toBe('scvVec');
      const items = encoded.vec()!;
      expect(items.map((item) => item.switch().name)).toEqual(['scvU32', 'scvU32', 'scvU32']);
      expect(items.map((item) => item.u32())).toEqual([2, 0, 1]);
    });

    it('encodes an empty permission set as an empty vec, not as a null', () => {
      const encoded = toScPermissionsVec([]);

      expect(encoded.switch().name).toBe('scvVec');
      expect(encoded.vec()).toHaveLength(0);
    });

    it('rejects a permission that is out of u32 range', () => {
      expect(() => toScPermissionsVec([0, 0x1_0000_0000])).toThrow(/Invalid u32 value/);
    });
  });

  describe('toScOperationsVec', () => {
    it('encodes each operation as its own XDR bytes entry', () => {
      const operations = [makeOperation('one'), makeOperation('two')];
      const encoded = toScOperationsVec(operations);

      expect(encoded.switch().name).toBe('scvVec');
      const items = encoded.vec()!;
      expect(items).toHaveLength(2);
      expect(items.map((item) => item.switch().name)).toEqual(['scvBytes', 'scvBytes']);

      // Each entry is the operation's own XDR, in the order given.
      items.forEach((item, index) => {
        expect(Buffer.from(item.bytes()).equals(Buffer.from(operations[index].toXDR()))).toBe(true);
      });
    });
  });

  describe('toScAddress', () => {
    it('encodes as scvAddress for a valid G… key', () => {
      const encoded = toScAddress(SESSION_KEYPAIR.publicKey());

      expect(encoded.switch().name).toBe('scvAddress');
    });

    it('rejects a contract address, which is not a valid session key', () => {
      expect(() => toScAddress(CONTRACT_ID)).toThrow(/Invalid Stellar public key/);
    });
  });
});

// ===========================================================================
// AccountTransactionBuilder — transaction lifecycle
// ===========================================================================

describe('AccountTransactionBuilder sequence handling (#1354)', () => {
  /**
   * The documented flow is `simulate()` to estimate fees, then `build()`.
   * `TransactionBuilder.build()` consumes a sequence number each call, so
   * doing both used to advance the source account twice and hand back a
   * transaction numbered one past what the network expects — `tx_bad_seq` on
   * submission, from the SDK's own recommended usage.
   */
  it('consumes exactly one sequence number across simulate() and build()', async () => {
    const server = makeFailingServer();
    const { builder, sourceAccount } = makeBuilder(server);
    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());

    await builder.simulate();
    await expect(builder.build()).rejects.toBeInstanceOf(SimulationFailedError);

    expect(sourceAccount.sequenceNumber()).toBe('101');

    // Both phases simulated the very same transaction object, so the fee and
    // footprint the first simulation produced describe the transaction the
    // second call assembles.
    const calls = (server.simulateTransaction as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toBe(calls[0][0]);
  });

  it('does not advance the sequence again on repeated simulate() calls', async () => {
    const server = makeFailingServer();
    const { builder, sourceAccount } = makeBuilder(server);
    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());

    await builder.simulate();
    await builder.simulate();
    await builder.simulate();

    expect(sourceAccount.sequenceNumber()).toBe('101');
  });

  it('rebuilds after a new operation is added, so late additions are not dropped', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());
    await builder.simulate();

    builder.addOperation(makeOperation());
    await builder.simulate();

    const first = (server.simulateTransaction as jest.Mock).mock.calls[0][0];
    const second = (server.simulateTransaction as jest.Mock).mock.calls[1][0];

    expect(first.operations).toHaveLength(1);
    expect(second.operations).toHaveLength(2);
  });

  it('rebuilds after a memo is attached', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());
    await builder.simulate();

    builder.addMemo(Memo.text('note'));
    await builder.simulate();

    const second = (server.simulateTransaction as jest.Mock).mock.calls[1][0];
    expect(second.memo.value?.toString()).toBe('note');
  });

  /**
   * `TransactionBuilder.setTimeout` refuses to overwrite an already-set
   * `TimeBounds.max_time`. The builder applies its own default timeout lazily
   * at build time, and used to do so without noticing that the caller had
   * already set one — so the documented `setTimeout()` override threw on the
   * next build instead of taking effect.
   */
  it('accepts an explicit setTimeout() before building', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());
    builder.setTimeout(60);

    await expect(builder.simulate()).resolves.toBeDefined();

    const tx = (server.simulateTransaction as jest.Mock).mock.calls[0][0];
    expect(Number(tx.timeBounds!.maxTime)).toBeGreaterThan(0);
  });
});

describe('AccountTransactionBuilder contract invocations (#1354)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends add_session_key with the address, permission vec and expiry in order', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    const expiresAt = 1_900_000_000;
    builder.addSessionKey(SESSION_KEYPAIR.publicKey(), [0, 2], expiresAt);
    await builder.simulate();

    const tx = (server.simulateTransaction as jest.Mock).mock.calls[0][0];
    const args = tx.operations[0].func.invokeContract().args();

    expect(tx.operations[0].func.invokeContract().functionName().toString()).toBe(
      'add_session_key'
    );
    expect(args[0].switch().name).toBe('scvAddress');
    expect(args[1].vec()!.map((item: xdr.ScVal) => item.u32())).toEqual([0, 2]);
    expect(args[2].switch().name).toBe('scvU64');
    expect(args[2].u64().toString()).toBe(String(expiresAt));
  });

  it('sends revoke_session_key with just the address', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());
    await builder.simulate();

    const tx = (server.simulateTransaction as jest.Mock).mock.calls[0][0];
    const invocation = tx.operations[0].func.invokeContract();

    expect(invocation.functionName().toString()).toBe('revoke_session_key');
    expect(invocation.args()).toHaveLength(1);
    expect(invocation.args()[0].switch().name).toBe('scvAddress');
  });

  it('sends execute with the session key and the operation bytes', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    const operations = [makeOperation('a'), makeOperation('b')];
    builder.execute(SESSION_KEYPAIR.publicKey(), operations);
    await builder.simulate();

    const tx = (server.simulateTransaction as jest.Mock).mock.calls[0][0];
    const invocation = tx.operations[0].func.invokeContract();

    expect(invocation.functionName().toString()).toBe('execute');
    expect(invocation.args()[0].switch().name).toBe('scvAddress');
    expect(invocation.args()[1].vec()).toHaveLength(2);
  });

  it('rejects an invalid session key before anything is added to the transaction', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    expect(() => builder.addSessionKey('not-an-address', [0], 1)).toThrow(
      /Invalid Stellar public key/
    );

    // The failed call left no partial operation behind.
    await expect(builder.simulate()).rejects.toThrow(/zero operations/);
  });
});

describe('AccountTransactionBuilder simulation outcomes (#1354)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces the RPC diagnostic on a failed simulation', async () => {
    const server = {
      simulateTransaction: jest.fn().mockResolvedValue({ error: 'HostError: budget exceeded' }),
    } as unknown as rpc.Server;

    const { builder } = makeBuilder(server);
    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());

    await expect(builder.build()).rejects.toBeInstanceOf(SimulationFailedError);
    await expect(builder.build()).rejects.toThrow(/budget exceeded/);
  });

  it('raises SimulationExpiredError when the ledger entries need restoring', async () => {
    const server = {
      simulateTransaction: jest.fn().mockResolvedValue({ restorePreamble: {} }),
    } as unknown as rpc.Server;

    jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
    jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(true);

    const { builder } = makeBuilder(server);
    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());

    await expect(builder.build()).rejects.toBeInstanceOf(SimulationExpiredError);
  });

  it('fails loudly rather than returning a half-assembled transaction on an unrecognised response', async () => {
    const server = {
      simulateTransaction: jest.fn().mockResolvedValue({ unexpected: true }),
    } as unknown as rpc.Server;

    jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
    jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(false);
    jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

    const { builder } = makeBuilder(server);
    builder.revokeSessionKey(SESSION_KEYPAIR.publicKey());

    await expect(builder.build()).rejects.toThrow(/Unexpected simulation response shape/);
  });

  it('refuses to simulate or build with no operations', async () => {
    const server = makeFailingServer();
    const { builder } = makeBuilder(server);

    await expect(builder.simulate()).rejects.toThrow(/zero operations/);
    await expect(builder.build()).rejects.toThrow(/zero operations/);
    expect(server.simulateTransaction).not.toHaveBeenCalled();
  });
});
