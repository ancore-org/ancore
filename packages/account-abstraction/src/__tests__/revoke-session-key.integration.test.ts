/**
 * Integration tests for revokeSessionKey — cross-module behaviour.
 *
 * Covers:
 *  1. revokeSessionKey composed into TransactionBuilder flows
 *  2. Error normalization via toCanonicalAccountError
 *  3. Interaction between revokeSessionKey and the transaction-builder's
 *     revokeSessionKey method (same contract, consistent op shape)
 *
 * Issue #588
 */

import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { randomBytes } from 'node:crypto';

import { revokeSessionKey } from '../revoke-session-key';
import { AccountContract, type AccountContractReadOptions } from '../account-contract';
import { TransactionBuilder } from '../transaction-builder';
import {
  SessionKeyNotFoundError,
  UnauthorizedError,
  SessionKeyExpiredError,
  ContractInvocationError,
  toCanonicalError as toCanonicalAccountError,
} from '../errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../account-contract', () => {
  const mockRevokeSessionKey = jest.fn();
  const mockBuildInvokeOperation = jest.fn();
  const MockAccountContract = jest.fn().mockImplementation(() => ({
    revokeSessionKey: mockRevokeSessionKey,
    buildInvokeOperation: mockBuildInvokeOperation,
  }));
  return {
    AccountContract: MockAccountContract,
    __mocks: { mockRevokeSessionKey, mockBuildInvokeOperation, MockAccountContract },
  };
});

const { __mocks } = jest.requireMock('../account-contract') as {
  __mocks: {
    mockRevokeSessionKey: jest.Mock;
    mockBuildInvokeOperation: jest.Mock;
    MockAccountContract: jest.Mock;
  };
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONTRACT_ID = StrKey.encodeContract(randomBytes(32));
const SESSION_KEY = Keypair.random().publicKey();
const SOURCE_ACCOUNT = Keypair.random().publicKey();

// ---------------------------------------------------------------------------
// 1. Composition with TransactionBuilder
// ---------------------------------------------------------------------------

describe('revokeSessionKey + TransactionBuilder composition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revokeSessionKey build result method matches TransactionBuilder revoke op', () => {
    const invocation = { method: 'revoke_session_key', args: [] };
    __mocks.mockRevokeSessionKey.mockReturnValue(invocation);

    const result = revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY });

    // TransactionBuilder uses 'revoke_session_key' as the contract method name
    expect(result.method).toBe('revoke_session_key');
  });

  it('TransactionBuilder.revokeSessionKey queues a revoke op', () => {
    const builder = new TransactionBuilder(SOURCE_ACCOUNT, CONTRACT_ID);
    builder.revokeSessionKey(SESSION_KEY);

    // @ts-expect-error: accessing private ops for assertion
    const ops = builder['ops'];
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      type: 'sessionKey',
      op: 'revoke',
      sessionKey: SESSION_KEY,
    });
  });

  it('TransactionBuilder simulate() reflects the queued revoke op count', async () => {
    const builder = new TransactionBuilder(SOURCE_ACCOUNT, CONTRACT_ID);
    builder.revokeSessionKey(SESSION_KEY);

    const sim = await builder.simulate();
    expect(sim.operationCount).toBe(1);
  });

  it('can chain revokeSessionKey with other builder ops', async () => {
    const builder = new TransactionBuilder(SOURCE_ACCOUNT, CONTRACT_ID);
    builder.addSessionKey('b'.repeat(64), [1], Date.now() + 60_000).revokeSessionKey(SESSION_KEY);

    const sim = await builder.simulate();
    expect(sim.operationCount).toBe(2);
  });

  it('revokeSessionKey write result contains both invocation and operation', async () => {
    const invocation = { method: 'revoke_session_key', args: [] };
    const operation = { type: 'invokeHostFunction', source: null };
    __mocks.mockRevokeSessionKey.mockReturnValue(invocation);
    __mocks.mockBuildInvokeOperation.mockReturnValue(operation);

    const result = await revokeSessionKey(
      CONTRACT_ID,
      { publicKey: SESSION_KEY },
      {} as AccountContractReadOptions
    );

    expect(result).toEqual({ invocation, operation });
    expect(__mocks.mockBuildInvokeOperation).toHaveBeenCalledWith(invocation);
  });
});

// ---------------------------------------------------------------------------
// 2. Error normalization paths
// ---------------------------------------------------------------------------

describe('revokeSessionKey error normalization via toCanonicalAccountError', () => {
  beforeEach(() => jest.clearAllMocks());

  it('SessionKeyNotFoundError normalizes to SESSION_KEY_NOT_FOUND code', () => {
    __mocks.mockRevokeSessionKey.mockImplementation(() => {
      throw new Error('Session key not found');
    });

    let caught: unknown;
    try {
      revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SessionKeyNotFoundError);
    const canonical = toCanonicalAccountError(caught);
    expect(canonical.code).toBe('SESSION_KEY_NOT_FOUND');
    expect(canonical.name).toBe('SessionKeyNotFoundError');
  });

  it('UnauthorizedError normalizes to UNAUTHORIZED code', () => {
    __mocks.mockRevokeSessionKey.mockImplementation(() => {
      throw new Error('Auth failure: unauthorized');
    });

    let caught: unknown;
    try {
      revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(UnauthorizedError);
    const canonical = toCanonicalAccountError(caught);
    expect(canonical.code).toBe('UNAUTHORIZED');
  });

  it('SessionKeyExpiredError normalizes to SESSION_KEY_EXPIRED code', () => {
    __mocks.mockRevokeSessionKey.mockImplementation(() => {
      throw new Error('Error(Contract, #6)');
    });

    let caught: unknown;
    try {
      revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SessionKeyExpiredError);
    const canonical = toCanonicalAccountError(caught);
    expect(canonical.code).toBe('SESSION_KEY_EXPIRED');
  });

  it('ContractInvocationError normalizes to CONTRACT_INVOCATION code', () => {
    __mocks.mockRevokeSessionKey.mockImplementation(() => {
      throw new Error('host invocation failed');
    });

    let caught: unknown;
    try {
      revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ContractInvocationError);
    const canonical = toCanonicalAccountError(caught);
    expect(canonical.code).toBe('CONTRACT_INVOCATION');
  });

  it('non-Error throwable normalizes gracefully', () => {
    __mocks.mockRevokeSessionKey.mockImplementation(() => {
      throw { weird: 'object' };
    });

    let caught: unknown;
    try {
      revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY });
    } catch (e) {
      caught = e;
    }

    const canonical = toCanonicalAccountError(caught);
    expect(canonical.code).toBe('CONTRACT_INVOCATION');
  });

  it('write path errors also normalize correctly', async () => {
    __mocks.mockRevokeSessionKey.mockImplementation(() => {
      throw new Error('Session key not found');
    });

    let caught: unknown;
    try {
      await revokeSessionKey(
        CONTRACT_ID,
        { publicKey: SESSION_KEY },
        {} as AccountContractReadOptions
      );
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SessionKeyNotFoundError);
    const canonical = toCanonicalAccountError(caught);
    expect(canonical.code).toBe('SESSION_KEY_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-module: AccountContract instance reuse
// ---------------------------------------------------------------------------

describe('revokeSessionKey with AccountContract instance (cross-module)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reuses the provided AccountContract instance without constructing a new one', () => {
    const invocation = { method: 'revoke_session_key', args: [] };
    __mocks.mockRevokeSessionKey.mockReturnValue(invocation);

    const contract = new AccountContract(CONTRACT_ID);
    __mocks.MockAccountContract.mockClear(); // clear constructor call from above

    revokeSessionKey(contract, { publicKey: SESSION_KEY });

    // Constructor should NOT have been called again
    expect(__mocks.MockAccountContract).not.toHaveBeenCalled();
    expect(__mocks.mockRevokeSessionKey).toHaveBeenCalledWith(SESSION_KEY);
  });

  it('accepts Uint8Array key in cross-module flow', () => {
    const key = new Uint8Array(32).fill(1);
    const invocation = { method: 'revoke_session_key', args: [] };
    __mocks.mockRevokeSessionKey.mockReturnValue(invocation);

    const contract = new AccountContract(CONTRACT_ID);
    const result = revokeSessionKey(contract, { publicKey: key });

    expect(__mocks.mockRevokeSessionKey).toHaveBeenCalledWith(key);
    expect(result).toBe(invocation);
  });
});
