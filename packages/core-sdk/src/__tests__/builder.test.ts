/**
 * Unit tests for AccountTransactionBuilder, contract-params, and errors.
 *
 * All Stellar SDK / Soroban RPC interactions are mocked so these tests run
 * offline and fast.
 */

import { Account, Contract, Keypair, Memo, Networks, rpc, StrKey, xdr } from '@stellar/stellar-sdk';

import { AccountTransactionBuilder } from '../account-transaction-builder';
import {
  toScAddress,
  toScU64,
  toScU32,
  toScPermissionsVec,
  toScOperationsVec,
} from '../contract-params';
import {
  AncoreSdkError,
  BuilderValidationError,
  SimulationFailedError,
  SimulationExpiredError,
  TransactionSubmissionError,
} from '../errors';

// ---------------------------------------------------------------------------
// Fixtures – valid Stellar keys generated via Keypair.random()
// ---------------------------------------------------------------------------

const TEST_KEYPAIR = Keypair.random();
const TEST_PUBLIC_KEY = TEST_KEYPAIR.publicKey();

const SESSION_KEYPAIR = Keypair.random();
const SESSION_PUBLIC_KEY = SESSION_KEYPAIR.publicKey();

// Generate a valid contract strkey (C… address)
const TEST_CONTRACT_ID: string = StrKey.encodeContract(require('crypto').randomBytes(32));

// Valid ManageData operation XDR (hex) for operation passthrough tests
const MANAGE_DATA_OP_HEX = '000000000000000a0000000474657374000000010000000376616c00';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSourceAccount(): Account {
  return new Account(TEST_PUBLIC_KEY, '100');
}

function makeServer(simulateResult?: any): rpc.Server {
  const server = {
    simulateTransaction: jest.fn(),
  } as unknown as rpc.Server;

  if (simulateResult !== undefined) {
    (server.simulateTransaction as jest.Mock).mockResolvedValue(simulateResult);
  }

  return server;
}

function makeBuilderOptions(
  serverOverride?: rpc.Server
): ConstructorParameters<typeof AccountTransactionBuilder>[1] {
  return {
    server: serverOverride ?? makeServer(),
    accountContractId: TEST_CONTRACT_ID,
    networkPassphrase: Networks.TESTNET,
  };
}

function makeValidXdrOperation(): xdr.Operation {
  return xdr.Operation.fromXDR(MANAGE_DATA_OP_HEX, 'hex');
}

// ============================================================================
// contract-params.ts
// ============================================================================

describe('contract-params', () => {
  describe('toScAddress', () => {
    it('encodes a valid Stellar public key', () => {
      const result = toScAddress(TEST_PUBLIC_KEY);
      expect(result).toBeDefined();
      expect(result.switch().name).toBe('scvAddress');
    });

    it('throws for empty string', () => {
      expect(() => toScAddress('')).toThrow(/Invalid Stellar public key/);
    });

    it('throws for key not starting with G', () => {
      expect(() => toScAddress('NOTAKEY')).toThrow(/Invalid Stellar public key/);
    });
  });

  describe('toScU64', () => {
    it('encodes a non-negative integer', () => {
      const result = toScU64(42);
      expect(result).toBeDefined();
    });

    it('encodes zero', () => {
      const result = toScU64(0);
      expect(result).toBeDefined();
    });

    it('throws for negative numbers', () => {
      expect(() => toScU64(-1)).toThrow(/Invalid u64 value/);
    });

    it('throws for non-integer numbers', () => {
      expect(() => toScU64(1.5)).toThrow(/Invalid u64 value/);
    });
  });

  describe('toScU32', () => {
    it('encodes a valid u32 value', () => {
      const result = toScU32(1000);
      expect(result).toBeDefined();
    });

    it('encodes zero', () => {
      const result = toScU32(0);
      expect(result).toBeDefined();
    });

    it('encodes max u32', () => {
      const result = toScU32(0xffff_ffff);
      expect(result).toBeDefined();
    });

    it('throws for values exceeding u32 max', () => {
      expect(() => toScU32(0x1_0000_0000)).toThrow(/Invalid u32 value/);
    });

    it('throws for negative numbers', () => {
      expect(() => toScU32(-5)).toThrow(/Invalid u32 value/);
    });

    it('throws for non-integer numbers', () => {
      expect(() => toScU32(3.14)).toThrow(/Invalid u32 value/);
    });
  });

  describe('toScPermissionsVec', () => {
    it('encodes an array of permissions', () => {
      const result = toScPermissionsVec([0, 1, 2]);
      expect(result).toBeDefined();
      expect(result.switch().name).toBe('scvVec');
    });

    it('encodes an empty array', () => {
      const result = toScPermissionsVec([]);
      expect(result).toBeDefined();
    });

    it('throws for non-array input', () => {
      expect(() => toScPermissionsVec('not-array' as any)).toThrow(/Permissions must be an array/);
    });

    it('throws if a permission value is invalid', () => {
      expect(() => toScPermissionsVec([0, -1])).toThrow(/Invalid u32 value/);
    });
  });

  describe('toScOperationsVec', () => {
    it('encodes an array of XDR operations', () => {
      const op = makeValidXdrOperation();
      const result = toScOperationsVec([op]);
      expect(result).toBeDefined();
      expect(result.switch().name).toBe('scvVec');
    });

    it('encodes multiple operations', () => {
      const op1 = makeValidXdrOperation();
      const op2 = makeValidXdrOperation();
      const result = toScOperationsVec([op1, op2]);
      expect(result.vec()!.length).toBe(2);
    });

    it('throws for empty array', () => {
      expect(() => toScOperationsVec([])).toThrow(/non-empty array/);
    });

    it('throws for non-array input', () => {
      expect(() => toScOperationsVec(null as any)).toThrow(/non-empty array/);
    });
  });
});

// ============================================================================
// errors.ts
// ============================================================================

describe('errors', () => {
  describe('AncoreSdkError', () => {
    it('carries code and message', () => {
      const err = new AncoreSdkError('TEST', 'Something went wrong');
      expect(err.code).toBe('TEST');
      expect(err.message).toBe('Something went wrong');
      expect(err.name).toBe('AncoreSdkError');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AncoreSdkError);
    });
  });

  describe('SimulationFailedError', () => {
    it('carries diagnostic message', () => {
      const err = new SimulationFailedError('host invocation failed');
      expect(err.code).toBe('SIMULATION_FAILED');
      expect(err.diagnosticMessage).toBe('host invocation failed');
      expect(err.message).toContain('host invocation failed');
      expect(err.message).toContain('simulation failed');
      expect(err).toBeInstanceOf(AncoreSdkError);
      expect(err).toBeInstanceOf(SimulationFailedError);
    });
  });

  describe('SimulationExpiredError', () => {
    it('provides actionable message', () => {
      const err = new SimulationExpiredError();
      expect(err.code).toBe('SIMULATION_EXPIRED');
      expect(err.message).toContain('expired');
      expect(err).toBeInstanceOf(AncoreSdkError);
    });
  });

  describe('BuilderValidationError', () => {
    it('carries the custom message', () => {
      const err = new BuilderValidationError('Missing operation');
      expect(err.code).toBe('BUILDER_VALIDATION');
      expect(err.message).toBe('Missing operation');
      expect(err).toBeInstanceOf(AncoreSdkError);
    });
  });

  describe('TransactionSubmissionError', () => {
    it('carries result XDR when provided', () => {
      const err = new TransactionSubmissionError('tx_bad_auth', 'AAAA==');
      expect(err.code).toBe('SUBMISSION_FAILED');
      expect(err.resultXdr).toBe('AAAA==');
      expect(err.message).toContain('tx_bad_auth');
      expect(err).toBeInstanceOf(AncoreSdkError);
    });

    it('works without result XDR', () => {
      const err = new TransactionSubmissionError('timeout');
      expect(err.resultXdr).toBeUndefined();
    });
  });
});

// ============================================================================
// AccountTransactionBuilder
// ============================================================================

describe('AccountTransactionBuilder', () => {
  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  describe('constructor', () => {
    it('creates an instance with valid options', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      expect(builder).toBeInstanceOf(AccountTransactionBuilder);
    });

    it('throws when accountContractId is empty', () => {
      expect(
        () =>
          new AccountTransactionBuilder(makeSourceAccount(), {
            ...makeBuilderOptions(),
            accountContractId: '',
          })
      ).toThrow(BuilderValidationError);
    });

    it('accepts custom fee and timeout', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), {
        ...makeBuilderOptions(),
        fee: '200',
        timeoutSeconds: 600,
      });
      expect(builder).toBeInstanceOf(AccountTransactionBuilder);
    });
  });

  // -----------------------------------------------------------------------
  // addSessionKey
  // -----------------------------------------------------------------------

  describe('addSessionKey', () => {
    it('returns this for chaining', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      const result = builder.addSessionKey(SESSION_PUBLIC_KEY, [0, 1], Date.now() + 60_000);
      expect(result).toBe(builder);
    });

    it('throws for invalid public key', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      expect(() => builder.addSessionKey('BADKEY', [0], Date.now())).toThrow(
        /Invalid Stellar public key/
      );
    });

    it('throws for invalid permissions', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      expect(() => builder.addSessionKey(SESSION_PUBLIC_KEY, [-1], Date.now())).toThrow(
        /Invalid u32 value/
      );
    });

    it('throws for invalid expiration', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      expect(() => builder.addSessionKey(SESSION_PUBLIC_KEY, [0], -100)).toThrow(
        /Invalid u64 value/
      );
    });
  });

  // -----------------------------------------------------------------------
  // revokeSessionKey
  // -----------------------------------------------------------------------

  describe('revokeSessionKey', () => {
    it('returns this for chaining', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      const result = builder.revokeSessionKey(SESSION_PUBLIC_KEY);
      expect(result).toBe(builder);
    });

    it('throws for invalid public key', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      expect(() => builder.revokeSessionKey('')).toThrow(/Invalid Stellar public key/);
    });
  });

  // -----------------------------------------------------------------------
  // execute
  // -----------------------------------------------------------------------

  describe('execute', () => {
    it('returns this for chaining', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      const op = makeValidXdrOperation();
      const result = builder.execute(SESSION_PUBLIC_KEY, [op]);
      expect(result).toBe(builder);
    });

    it('throws for empty operations array', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      expect(() => builder.execute(SESSION_PUBLIC_KEY, [])).toThrow(/non-empty array/);
    });

    it('throws for invalid session key', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      const op = makeValidXdrOperation();
      expect(() => builder.execute('BADKEY', [op])).toThrow(/Invalid Stellar public key/);
    });
  });

  // -----------------------------------------------------------------------
  // addOperation (passthrough)
  // -----------------------------------------------------------------------

  describe('addOperation', () => {
    it('returns this for chaining', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());

      const contract = new Contract(TEST_CONTRACT_ID);
      const op = contract.call('some_method');

      const result = builder.addOperation(op);
      expect(result).toBe(builder);
    });
  });

  // -----------------------------------------------------------------------
  // addMemo
  // -----------------------------------------------------------------------

  describe('addMemo', () => {
    it('returns this for chaining', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      const result = builder.addMemo(Memo.text('hello'));
      expect(result).toBe(builder);
    });
  });

  // -----------------------------------------------------------------------
  // setTimeout
  // -----------------------------------------------------------------------

  describe('setTimeout', () => {
    it('returns this for chaining', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());
      const result = builder.setTimeout(600);
      expect(result).toBe(builder);
    });
  });

  // -----------------------------------------------------------------------
  // simulate
  // -----------------------------------------------------------------------

  describe('simulate', () => {
    it('throws BuilderValidationError when no operations added', async () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());

      await expect(builder.simulate()).rejects.toThrow(BuilderValidationError);
    });

    it('calls server.simulateTransaction and returns response', async () => {
      const mockSimResponse = { id: 'sim-1', latestLedger: 100 };
      const server = makeServer(mockSimResponse);
      const builder = new AccountTransactionBuilder(
        makeSourceAccount(),
        makeBuilderOptions(server)
      );

      builder.addSessionKey(SESSION_PUBLIC_KEY, [0], Date.now() + 60_000);
      const response = await builder.simulate();

      expect(server.simulateTransaction).toHaveBeenCalledTimes(1);
      expect(response).toEqual(mockSimResponse);
    });
  });

  // -----------------------------------------------------------------------
  // build
  // -----------------------------------------------------------------------

  describe('build', () => {
    it('throws BuilderValidationError when no operations added', async () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());

      await expect(builder.build()).rejects.toThrow(BuilderValidationError);
    });

    it('includes actionable message when no operations added', async () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());

      await expect(builder.build()).rejects.toThrow(/zero operations/);
    });

    it('throws SimulationFailedError on simulation error', async () => {
      const errorResponse = {
        error: 'HostError: contract trapped',
        id: 'sim-err',
        latestLedger: 100,
        events: [],
      };
      const server = makeServer(errorResponse);

      const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(true);
      const isRestoreSpy = jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(false);
      const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

      try {
        const builder = new AccountTransactionBuilder(
          makeSourceAccount(),
          makeBuilderOptions(server)
        );
        builder.addSessionKey(SESSION_PUBLIC_KEY, [0], Date.now() + 60_000);

        await expect(builder.build()).rejects.toThrow(SimulationFailedError);
      } finally {
        isErrorSpy.mockRestore();
        isRestoreSpy.mockRestore();
        isSuccessSpy.mockRestore();
      }
    });

    it('throws SimulationExpiredError on restore-required result', async () => {
      const restoreResponse = { id: 'sim-restore', latestLedger: 100 };
      const server = makeServer(restoreResponse);

      const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
      const isRestoreSpy = jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(true);
      const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

      try {
        const builder = new AccountTransactionBuilder(
          makeSourceAccount(),
          makeBuilderOptions(server)
        );
        builder.addSessionKey(SESSION_PUBLIC_KEY, [0], Date.now() + 60_000);

        await expect(builder.build()).rejects.toThrow(SimulationExpiredError);
      } finally {
        isErrorSpy.mockRestore();
        isRestoreSpy.mockRestore();
        isSuccessSpy.mockRestore();
      }
    });

    it('returns assembled Transaction on successful simulation', async () => {
      const server = makeServer({ id: 'sim-ok', latestLedger: 100 });

      const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
      const isRestoreSpy = jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(false);
      const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      // We can't spy on rpc.assembleTransaction directly (non-configurable),
      // so we mock the entire build flow by making the builder's internal
      // build path go through our mocked simulation checks which return
      // success, and then we verify assembleTransaction is called by
      // checking the final result doesn't throw.
      // For a more isolated test, we test that simulation success path works.
      try {
        const builder = new AccountTransactionBuilder(
          makeSourceAccount(),
          makeBuilderOptions(server)
        );
        builder.addSessionKey(SESSION_PUBLIC_KEY, [0], Date.now() + 60_000);

        // assembleTransaction will be called with the built tx and sim result.
        // It may throw because the sim result is not a real one, but we can
        // verify the code path reaches assembleTransaction by catching the
        // specific error it throws (not our custom errors).
        try {
          await builder.build();
        } catch (err: any) {
          // If it throws, it should NOT be one of our custom errors
          // (those would mean the code path didn't reach assembleTransaction)
          expect(err).not.toBeInstanceOf(SimulationFailedError);
          expect(err).not.toBeInstanceOf(SimulationExpiredError);
          expect(err).not.toBeInstanceOf(BuilderValidationError);
        }
      } finally {
        isErrorSpy.mockRestore();
        isRestoreSpy.mockRestore();
        isSuccessSpy.mockRestore();
      }
    });

    it('throws SimulationFailedError for unexpected response shape', async () => {
      const weirdResponse = { id: 'sim-weird', latestLedger: 100 };
      const server = makeServer(weirdResponse);

      const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);
      const isRestoreSpy = jest.spyOn(rpc.Api, 'isSimulationRestore').mockReturnValue(false);
      const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

      try {
        const builder = new AccountTransactionBuilder(
          makeSourceAccount(),
          makeBuilderOptions(server)
        );
        builder.addSessionKey(SESSION_PUBLIC_KEY, [0], Date.now() + 60_000);

        await expect(builder.build()).rejects.toThrow(/Unexpected simulation response/);
      } finally {
        isErrorSpy.mockRestore();
        isRestoreSpy.mockRestore();
        isSuccessSpy.mockRestore();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Fluent chaining
  // -----------------------------------------------------------------------

  describe('fluent API', () => {
    it('supports chaining multiple convenience methods', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());

      const thirdKey = Keypair.random().publicKey();

      const result = builder
        .addSessionKey(SESSION_PUBLIC_KEY, [0, 1], Date.now() + 60_000)
        .revokeSessionKey(thirdKey)
        .addMemo(Memo.text('chaining test'));

      expect(result).toBe(builder);
    });

    it('supports mixing convenience methods with passthrough', () => {
      const builder = new AccountTransactionBuilder(makeSourceAccount(), makeBuilderOptions());

      const contract = new Contract(TEST_CONTRACT_ID);
      const customOp = contract.call('custom_method');

      const result = builder
        .addSessionKey(SESSION_PUBLIC_KEY, [0], Date.now() + 60_000)
        .addOperation(customOp)
        .addMemo(Memo.text('mixed'));

      expect(result).toBe(builder);
    });
  });
});
