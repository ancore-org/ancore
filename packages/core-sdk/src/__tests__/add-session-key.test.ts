import { AccountContract, AccountContractError } from '@ancore/account-abstraction';

import {
  addSessionKey,
  AncoreClient,
  BuilderValidationError,
  SessionKeyManagementError,
  type AddSessionKeyParams,
} from '../index';

jest.mock('@ancore/account-abstraction', () => {
  const addSessionKey = jest.fn();
  const AccountContract = jest.fn().mockImplementation(() => ({
    addSessionKey,
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

  return {
    AccountContract,
    AccountContractError: MockAccountContractError,
    __mocked: {
      addSessionKey,
      AccountContract,
    },
  };
});

const mockedAccountAbstraction = jest.requireMock('@ancore/account-abstraction') as {
  __mocked: {
    addSessionKey: jest.Mock;
    AccountContract: jest.Mock;
  };
};

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const SESSION_PUBLIC_KEY = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

describe('addSessionKey', () => {
  const params: AddSessionKeyParams = {
    publicKey: SESSION_PUBLIC_KEY,
    permissions: [0, 2],
    expiresAt: 1_700_000_000,
  };

  beforeEach(() => {
    mockedAccountAbstraction.__mocked.addSessionKey.mockReset();
    mockedAccountAbstraction.__mocked.AccountContract.mockClear();
  });

  it('delegates to the account abstraction contract and returns invocation args', () => {
    const invocation = { method: 'add_session_key', args: [] };
    mockedAccountAbstraction.__mocked.addSessionKey.mockReturnValue(invocation);

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });
    const result = client.addSessionKey(params);

    expect(AccountContract).toHaveBeenCalledWith(CONTRACT_ID);
    expect(mockedAccountAbstraction.__mocked.addSessionKey).toHaveBeenCalledWith(
      params.publicKey,
      params.permissions,
      params.expiresAt
    );
    expect(result).toBe(invocation);
  });

  it('supports direct helper usage with any session-key writer', () => {
    const invocation = { method: 'add_session_key', args: [] };
    const writer = {
      addSessionKey: jest.fn().mockReturnValue(invocation),
    };

    const result = addSessionKey(writer, params);

    expect(writer.addSessionKey).toHaveBeenCalledWith(
      params.publicKey,
      params.permissions,
      params.expiresAt
    );
    expect(result).toBe(invocation);
  });

  it('maps account-abstraction errors to SessionKeyManagementError', () => {
    mockedAccountAbstraction.__mocked.addSessionKey.mockImplementation(() => {
      throw new AccountContractError('Caller is not authorized', 'UNAUTHORIZED');
    });

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() => client.addSessionKey(params)).toThrow(SessionKeyManagementError);

    try {
      client.addSessionKey(params);
    } catch (error) {
      expect(error).toBeInstanceOf(SessionKeyManagementError);
      expect(error).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Caller is not authorized',
      });
    }
  });

  it('maps validation-style dependency errors to BuilderValidationError', () => {
    mockedAccountAbstraction.__mocked.addSessionKey.mockImplementation(() => {
      throw new Error('Invalid Stellar public key: expected a G… address, received "BADKEY"');
    });

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.addSessionKey({
        ...params,
        publicKey: 'BADKEY',
      })
    ).toThrow(BuilderValidationError);
  });

  it('rejects malformed public parameters before delegation', () => {
    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.addSessionKey({
        ...params,
        publicKey: ' ',
      })
    ).toThrow(BuilderValidationError);

    expect(mockedAccountAbstraction.__mocked.addSessionKey).not.toHaveBeenCalled();
  });

  it('rejects missing parameter objects', () => {
    expect(() => addSessionKey({ addSessionKey: jest.fn() }, undefined as never)).toThrow(
      'addSessionKey requires a parameter object with publicKey, permissions, and expiresAt.'
    );
  });

  it('rejects non-array permissions', () => {
    expect(() =>
      addSessionKey({ addSessionKey: jest.fn() }, { ...params, permissions: 'read' as never })
    ).toThrow('addSessionKey requires permissions to be an array.');
  });

  it('rejects non-finite expiration timestamps', () => {
    expect(() =>
      addSessionKey({ addSessionKey: jest.fn() }, { ...params, expiresAt: Number.NaN })
    ).toThrow('addSessionKey requires expiresAt to be a finite number.');
  });

  it('preserves existing core-sdk errors', () => {
    const expected = new SessionKeyManagementError('existing error', 'EXISTING');
    const writer = {
      addSessionKey: jest.fn(() => {
        throw expected;
      }),
    };

    expect(() => addSessionKey(writer, params)).toThrow(expected);
  });

  it('wraps unexpected dependency errors with a stable fallback code', () => {
    const writer = {
      addSessionKey: jest.fn(() => {
        throw new Error('network flake');
      }),
    };

    expect(() => addSessionKey(writer, params)).toThrow(
      expect.objectContaining({
        code: 'SESSION_KEY_ADD_FAILED',
        message: 'Failed to add session key: network flake',
      })
    );
  });

  it('wraps non-error throwables with the unknown fallback', () => {
    const writer = {
      addSessionKey: jest.fn(() => {
        throw 'boom';
      }),
    };

    expect(() => addSessionKey(writer, params)).toThrow(
      expect.objectContaining({
        code: 'SESSION_KEY_ADD_FAILED',
        message: 'Failed to add session key due to an unknown error.',
      })
    );
  });
});
