import {
  AccountContract,
  AccountContractError,
  publicKeyToBytes32ScVal,
  u64ToScVal,
} from '@ancore/account-abstraction';
import { Account, Keypair, Networks, rpc, xdr } from '@stellar/stellar-sdk';

import {
  refreshSessionKeyTtl,
  parseSessionKeyTtlRefreshedEvent,
  AncoreClient,
  BuilderValidationError,
  SessionKeyManagementError,
  SimulationFailedError,
  type RefreshSessionKeyTtlParams,
} from '../index';

jest.mock('@ancore/account-abstraction', () => {
  const refreshSessionKeyTtl = jest.fn();
  const buildInvokeOperation = jest.fn();
  const AccountContract = jest.fn().mockImplementation(() => ({
    refreshSessionKeyTtl,
    buildInvokeOperation,
  }));

  class MockAccountContractError extends Error {
    public readonly code: string;

    constructor(message: string, code: string = 'ACCOUNT_CONTRACT_ERROR') {
      super(message);
      this.name = 'AccountContractError';
      this.code = code;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }

  const actual = jest.requireActual('@ancore/account-abstraction');

  return {
    ...actual,
    AccountContract,
    AccountContractError: MockAccountContractError,
    __mocked: {
      refreshSessionKeyTtl,
      buildInvokeOperation,
      AccountContract,
    },
  };
});

const mockedAccountAbstraction = jest.requireMock('@ancore/account-abstraction') as {
  __mocked: {
    refreshSessionKeyTtl: jest.Mock;
    buildInvokeOperation: jest.Mock;
    AccountContract: jest.Mock;
  };
};

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const SESSION_PUBLIC_KEY = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';
const NOW_MS = Date.now();
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

function makeActiveParams(overrides: Partial<RefreshSessionKeyTtlParams> = {}): RefreshSessionKeyTtlParams {
  return {
    publicKey: SESSION_PUBLIC_KEY,
    expiresAt: NOW_SECONDS + 3600,
    ...overrides,
  };
}

function makeSessionKeyTtlRefreshedEvent(publicKey: string, expiresAt: number): {
  event: xdr.ContractEvent;
} {
  const dataScVal = xdr.ScVal.scvVec([
    publicKeyToBytes32ScVal(publicKey),
    u64ToScVal(expiresAt),
  ]);

  const contractEvent = {
    body: () => ({
      v0: () => ({
        topics: () => [xdr.ScVal.scvSymbol('session_key_ttl_refreshed')],
        data: () => dataScVal,
      }),
    }),
  } as unknown as xdr.ContractEvent;

  return { event: contractEvent };
}

describe('refreshSessionKeyTtl', () => {
  const params = makeActiveParams();

  beforeEach(() => {
    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockReset();
    mockedAccountAbstraction.__mocked.buildInvokeOperation.mockReset();
    mockedAccountAbstraction.__mocked.AccountContract.mockClear();
  });

  it('delegates to the account abstraction contract and returns invocation args', () => {
    const invocation = { method: 'refresh_session_key_ttl', args: [] };
    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockReturnValue(invocation);

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });
    const result = client.refreshSessionKeyTtl(params);

    expect(mockedAccountAbstraction.__mocked.AccountContract).toHaveBeenCalledWith(CONTRACT_ID);
    expect(mockedAccountAbstraction.__mocked.refreshSessionKeyTtl).toHaveBeenCalledWith(
      params.publicKey
    );
    expect(result).toBe(invocation);
  });

  it('supports direct helper usage with any session-key TTL refresher', () => {
    const invocation = { method: 'refresh_session_key_ttl', args: [] };
    const refresher = {
      refreshSessionKeyTtl: jest.fn().mockReturnValue(invocation),
      buildInvokeOperation: jest.fn(),
    };

    const result = refreshSessionKeyTtl(refresher, params);

    expect(refresher.refreshSessionKeyTtl).toHaveBeenCalledWith(params.publicKey);
    expect(result).toBe(invocation);
  });

  it('maps account-abstraction unauthorized errors to SessionKeyManagementError', () => {
    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockImplementation(() => {
      throw new AccountContractError('Caller is not authorized', 'UNAUTHORIZED');
    });

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() => client.refreshSessionKeyTtl(params)).toThrow(SessionKeyManagementError);

    try {
      client.refreshSessionKeyTtl(params);
    } catch (error) {
      expect(error).toBeInstanceOf(SessionKeyManagementError);
      expect(error).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Caller is not authorized',
      });
    }
  });

  it('rejects expired keys before delegation using isSessionKeyActive semantics', () => {
    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.refreshSessionKeyTtl({
        ...params,
        expiresAt: NOW_SECONDS - 1,
      })
    ).toThrow(SessionKeyManagementError);

    expect(mockedAccountAbstraction.__mocked.refreshSessionKeyTtl).not.toHaveBeenCalled();
  });

  it('rejects revoked keys before delegation', () => {
    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.refreshSessionKeyTtl({
        ...params,
        expiresAt: 0,
      })
    ).toThrow(BuilderValidationError);

    expect(mockedAccountAbstraction.__mocked.refreshSessionKeyTtl).not.toHaveBeenCalled();
  });

  it('rejects malformed public parameters before delegation', () => {
    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.refreshSessionKeyTtl({
        ...params,
        publicKey: ' ',
      })
    ).toThrow(BuilderValidationError);

    expect(mockedAccountAbstraction.__mocked.refreshSessionKeyTtl).not.toHaveBeenCalled();
  });

  it('simulates, maps contract errors, and parses session_key_ttl_refreshed events', async () => {
    const invocation = { method: 'refresh_session_key_ttl', args: [] };
    const operation = xdr.Operation.fromXDR(
      '000000000000000a0000000474657374000000010000000376616c00',
      'hex'
    );
    const contractEvent = makeSessionKeyTtlRefreshedEvent(params.publicKey, params.expiresAt);

    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockReturnValue(invocation);
    mockedAccountAbstraction.__mocked.buildInvokeOperation.mockReturnValue(operation);

    const simulateTransaction = jest.fn().mockResolvedValue({
      events: [contractEvent],
      cost: { cpuInsns: '0', memBytes: '0' },
      results: [],
      latestLedger: 1,
    });

    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: SESSION_PUBLIC_KEY, sequence: '42' }),
      simulateTransaction,
    } as unknown as rpc.Server;

    const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(true);
    const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);

    try {
      const result = await refreshSessionKeyTtl(
        {
          refreshSessionKeyTtl: mockedAccountAbstraction.__mocked.refreshSessionKeyTtl,
          buildInvokeOperation: mockedAccountAbstraction.__mocked.buildInvokeOperation,
        },
        params,
        {
          server,
          sourceAccount: SESSION_PUBLIC_KEY,
          networkPassphrase: Networks.TESTNET,
          nowMs: NOW_MS,
        }
      );

      expect(simulateTransaction).toHaveBeenCalledTimes(1);
      expect(result.invocation).toBe(invocation);
      expect(result.operation).toBe(operation);
      expect(result.event).toEqual({
        type: 'session_key_ttl_refreshed',
        publicKey: params.publicKey,
        expiresAt: params.expiresAt,
      });
    } finally {
      isSuccessSpy.mockRestore();
      isErrorSpy.mockRestore();
    }
  });

  it('maps simulation unauthorized errors to SessionKeyManagementError', async () => {
    const invocation = { method: 'refresh_session_key_ttl', args: [] };
    const operation = xdr.Operation.fromXDR(
      '000000000000000a0000000474657374000000010000000376616c00',
      'hex'
    );

    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockReturnValue(invocation);
    mockedAccountAbstraction.__mocked.buildInvokeOperation.mockReturnValue(operation);

    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: SESSION_PUBLIC_KEY, sequence: '42' }),
      simulateTransaction: jest.fn().mockResolvedValue({
        error: 'Auth failure: unauthorized',
        latestLedger: 1,
      }),
    } as unknown as rpc.Server;

    const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
    const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(true);

    try {
      await expect(
        refreshSessionKeyTtl(
          {
            refreshSessionKeyTtl: mockedAccountAbstraction.__mocked.refreshSessionKeyTtl,
            buildInvokeOperation: mockedAccountAbstraction.__mocked.buildInvokeOperation,
          },
          params,
          {
            server,
            sourceAccount: SESSION_PUBLIC_KEY,
            networkPassphrase: Networks.TESTNET,
            nowMs: NOW_MS,
          }
        )
      ).rejects.toThrow(SessionKeyManagementError);
    } finally {
      isSuccessSpy.mockRestore();
      isErrorSpy.mockRestore();
    }
  });

  it('maps simulation expired-key contract errors to SessionKeyManagementError', async () => {
    const invocation = { method: 'refresh_session_key_ttl', args: [] };
    const operation = xdr.Operation.fromXDR(
      '000000000000000a0000000474657374000000010000000376616c00',
      'hex'
    );

    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockReturnValue(invocation);
    mockedAccountAbstraction.__mocked.buildInvokeOperation.mockReturnValue(operation);

    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: SESSION_PUBLIC_KEY, sequence: '42' }),
      simulateTransaction: jest.fn().mockResolvedValue({
        error: 'Error(Contract, #6)',
        latestLedger: 1,
      }),
    } as unknown as rpc.Server;

    const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
    const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(true);

    try {
      await expect(
        refreshSessionKeyTtl(
          {
            refreshSessionKeyTtl: mockedAccountAbstraction.__mocked.refreshSessionKeyTtl,
            buildInvokeOperation: mockedAccountAbstraction.__mocked.buildInvokeOperation,
          },
          params,
          {
            server,
            sourceAccount: SESSION_PUBLIC_KEY,
            networkPassphrase: Networks.TESTNET,
            nowMs: NOW_MS,
          }
        )
      ).rejects.toMatchObject({ code: 'SESSION_KEY_EXPIRED' });
    } finally {
      isSuccessSpy.mockRestore();
      isErrorSpy.mockRestore();
    }
  });

  it('wraps unexpected dependency errors with a stable fallback code', () => {
    const writer = {
      refreshSessionKeyTtl: jest.fn(() => {
        throw new Error('network flake');
      }),
      buildInvokeOperation: jest.fn(),
    };

    expect(() => refreshSessionKeyTtl(writer, params)).toThrow(
      expect.objectContaining({
        code: 'SESSION_KEY_TTL_REFRESH_FAILED',
        message: 'Failed to refresh session key TTL: network flake',
      })
    );
  });

  it('wraps non-error throwables with the unknown fallback', () => {
    const writer = {
      refreshSessionKeyTtl: jest.fn(() => {
        throw 'boom';
      }),
      buildInvokeOperation: jest.fn(),
    };

    expect(() => refreshSessionKeyTtl(writer, params)).toThrow(
      expect.objectContaining({
        code: 'SESSION_KEY_TTL_REFRESH_FAILED',
        message: 'Failed to refresh session key TTL due to an unknown error.',
      })
    );
  });

  it('preserves existing core-sdk errors', () => {
    const expected = new SessionKeyManagementError('existing error', 'EXISTING');
    const writer = {
      refreshSessionKeyTtl: jest.fn(() => {
        throw expected;
      }),
      buildInvokeOperation: jest.fn(),
    };

    expect(() => refreshSessionKeyTtl(writer, params)).toThrow(expected);
  });

  it('rejects missing parameter objects and non-finite expiresAt', () => {
    expect(() =>
      refreshSessionKeyTtl(
        { refreshSessionKeyTtl: jest.fn(), buildInvokeOperation: jest.fn() },
        undefined as never
      )
    ).toThrow('refreshSessionKeyTtl requires a parameter object with publicKey and expiresAt.');

    expect(() =>
      refreshSessionKeyTtl(
        { refreshSessionKeyTtl: jest.fn(), buildInvokeOperation: jest.fn() },
        { ...params, expiresAt: Number.NaN }
      )
    ).toThrow('refreshSessionKeyTtl requires expiresAt to be a finite number.');
  });

  it('maps validation-style dependency errors to BuilderValidationError', () => {
    const writer = {
      refreshSessionKeyTtl: jest.fn(() => {
        throw new Error('Invalid Ed25519 public key: expected G... format');
      }),
      buildInvokeOperation: jest.fn(),
    };

    expect(() => refreshSessionKeyTtl(writer, params)).toThrow(BuilderValidationError);
  });

  it('throws SimulationFailedError for unexpected simulation response shapes', async () => {
    const invocation = { method: 'refresh_session_key_ttl', args: [] };
    const operation = xdr.Operation.fromXDR(
      '000000000000000a0000000474657374000000010000000376616c00',
      'hex'
    );

    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockReturnValue(invocation);
    mockedAccountAbstraction.__mocked.buildInvokeOperation.mockReturnValue(operation);

    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: SESSION_PUBLIC_KEY, sequence: '42' }),
      simulateTransaction: jest.fn().mockResolvedValue({ latestLedger: 1 }),
    } as unknown as rpc.Server;

    const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
    const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(false);

    try {
      await expect(
        refreshSessionKeyTtl(
          {
            refreshSessionKeyTtl: mockedAccountAbstraction.__mocked.refreshSessionKeyTtl,
            buildInvokeOperation: mockedAccountAbstraction.__mocked.buildInvokeOperation,
          },
          params,
          {
            server,
            sourceAccount: SESSION_PUBLIC_KEY,
            networkPassphrase: Networks.TESTNET,
          }
        )
      ).rejects.toThrow(SimulationFailedError);
    } finally {
      isSuccessSpy.mockRestore();
      isErrorSpy.mockRestore();
    }
  });

  it('maps generic simulation host errors to SimulationFailedError', async () => {
    const invocation = { method: 'refresh_session_key_ttl', args: [] };
    const operation = xdr.Operation.fromXDR(
      '000000000000000a0000000474657374000000010000000376616c00',
      'hex'
    );

    mockedAccountAbstraction.__mocked.refreshSessionKeyTtl.mockReturnValue(invocation);
    mockedAccountAbstraction.__mocked.buildInvokeOperation.mockReturnValue(operation);

    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: SESSION_PUBLIC_KEY, sequence: '42' }),
      simulateTransaction: jest.fn().mockResolvedValue({
        error: 'host invocation failed',
        latestLedger: 1,
      }),
    } as unknown as rpc.Server;

    const isSuccessSpy = jest.spyOn(rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
    const isErrorSpy = jest.spyOn(rpc.Api, 'isSimulationError').mockReturnValue(true);

    try {
      await expect(
        refreshSessionKeyTtl(
          {
            refreshSessionKeyTtl: mockedAccountAbstraction.__mocked.refreshSessionKeyTtl,
            buildInvokeOperation: mockedAccountAbstraction.__mocked.buildInvokeOperation,
          },
          params,
          {
            server,
            sourceAccount: SESSION_PUBLIC_KEY,
            networkPassphrase: Networks.TESTNET,
          }
        )
      ).rejects.toThrow(SimulationFailedError);
    } finally {
      isSuccessSpy.mockRestore();
      isErrorSpy.mockRestore();
    }
  });
});

describe('parseSessionKeyTtlRefreshedEvent', () => {
  it('returns null when no matching event is present', () => {
    expect(parseSessionKeyTtlRefreshedEvent([])).toBeNull();
    expect(parseSessionKeyTtlRefreshedEvent(undefined)).toBeNull();
  });

  it('parses a session_key_ttl_refreshed contract event envelope', () => {
    const contractEvent = makeSessionKeyTtlRefreshedEvent(SESSION_PUBLIC_KEY, NOW_SECONDS + 3600);

    expect(parseSessionKeyTtlRefreshedEvent([contractEvent])).toEqual({
      type: 'session_key_ttl_refreshed',
      publicKey: SESSION_PUBLIC_KEY,
      expiresAt: NOW_SECONDS + 3600,
    });
  });

  it('ignores events with non-matching topics or malformed payloads', () => {
    const malformed = {
      event: {
        body: () => ({
          v0: () => ({
            topics: () => [xdr.ScVal.scvSymbol('session_key_added')],
            data: () => xdr.ScVal.scvVec([]),
          }),
        }),
      },
    };

    expect(parseSessionKeyTtlRefreshedEvent([malformed])).toBeNull();
    expect(parseSessionKeyTtlRefreshedEvent([null as never, 'bad' as never])).toBeNull();
  });

  it('reads contract events from contractEvent envelopes', () => {
    const contractEvent = makeSessionKeyTtlRefreshedEvent(SESSION_PUBLIC_KEY, NOW_SECONDS + 3600);

    expect(
      parseSessionKeyTtlRefreshedEvent([{ contractEvent: contractEvent.event }])
    ).toEqual({
      type: 'session_key_ttl_refreshed',
      publicKey: SESSION_PUBLIC_KEY,
      expiresAt: NOW_SECONDS + 3600,
    });
  });
});

describe('refreshSessionKeyTtl + AccountContract integration', () => {
  it('builds refresh_session_key_ttl invocation with BytesN<32> public key arg', () => {
    const { AccountContract: RealAccountContract } = jest.requireActual(
      '@ancore/account-abstraction'
    ) as { AccountContract: typeof AccountContract };

    const contract = new RealAccountContract(CONTRACT_ID);
    const invocation = contract.refreshSessionKeyTtl(SESSION_PUBLIC_KEY);

    expect(invocation.method).toBe('refresh_session_key_ttl');
    expect(invocation.args).toHaveLength(1);
    expect(invocation.args[0].switch().name).toBe('scvBytes');
  });
});

describe('refreshSessionKeyTtl + TransactionBuilder integration', () => {
  it('builds a valid refresh_session_key_ttl invocation via account-abstraction builder', async () => {
    const { TransactionBuilder } = jest.requireActual('@ancore/account-abstraction') as {
      TransactionBuilder: typeof import('@ancore/account-abstraction').TransactionBuilder;
    };

    const source = Keypair.random().publicKey();
    const builder = new TransactionBuilder(source, CONTRACT_ID);
    builder.refreshSessionKeyTtl({ publicKey: SESSION_PUBLIC_KEY, ttlSeconds: 3600 });

    // @ts-expect-error private ops for assertion
    expect(builder['ops']).toContainEqual({
      type: 'sessionKey',
      op: 'refreshTtl',
      sessionKey: SESSION_PUBLIC_KEY,
      permissions: [],
      expiresAt: 0,
      ttlSeconds: 3600,
    });

    await builder.simulate();
    const tx = builder.build();
    expect(tx).toBeDefined();
  });
});
