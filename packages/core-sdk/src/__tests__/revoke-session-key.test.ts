import { AccountContract, AccountContractError } from '@ancore/account-abstraction';

import {
  revokeSessionKey,
  AncoreClient,
  BuilderValidationError,
  SessionKeyManagementError,
  type RevokeSessionKeyParams,
} from '../index';

jest.mock('@ancore/account-abstraction', () => {
  const revokeSessionKey = jest.fn();
  const AccountContract = jest.fn().mockImplementation(() => ({
    revokeSessionKey,
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
      revokeSessionKey,
      AccountContract,
    },
  };
});

const mockedAccountAbstraction = jest.requireMock('@ancore/account-abstraction') as {
  __mocked: {
    revokeSessionKey: jest.Mock;
    AccountContract: jest.Mock;
  };
};

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const SESSION_PUBLIC_KEY = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

describe('revokeSessionKey', () => {
  const params: RevokeSessionKeyParams = {
    publicKey: SESSION_PUBLIC_KEY,
  };

  beforeEach(() => {
    mockedAccountAbstraction.__mocked.revokeSessionKey.mockReset();
    mockedAccountAbstraction.__mocked.AccountContract.mockClear();
  });

  it('delegates to the account abstraction contract and returns invocation args', () => {
    const invocation = { method: 'revoke_session_key', args: [] };
    mockedAccountAbstraction.__mocked.revokeSessionKey.mockReturnValue(invocation);

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });
    const result = client.revokeSessionKey(params);

    expect(AccountContract).toHaveBeenCalledWith(CONTRACT_ID);
    expect(mockedAccountAbstraction.__mocked.revokeSessionKey).toHaveBeenCalledWith(
      params.publicKey
    );
    expect(result).toBe(invocation);
  });

  it('supports direct helper usage with any session-key revoker', () => {
    const invocation = { method: 'revoke_session_key', args: [] };
    const revoker = {
      revokeSessionKey: jest.fn().mockReturnValue(invocation),
    };

    const result = revokeSessionKey(revoker, params);

    expect(revoker.revokeSessionKey).toHaveBeenCalledWith(params.publicKey);
    expect(result).toBe(invocation);
  });

  it('maps account-abstraction errors to SessionKeyManagementError', () => {
    mockedAccountAbstraction.__mocked.revokeSessionKey.mockImplementation(() => {
      throw new AccountContractError('Caller is not authorized', 'UNAUTHORIZED');
    });

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() => client.revokeSessionKey(params)).toThrow(SessionKeyManagementError);

    try {
      client.revokeSessionKey(params);
    } catch (error) {
      expect(error).toBeInstanceOf(SessionKeyManagementError);
      expect(error).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Caller is not authorized',
      });
    }
  });

  it('maps validation-style dependency errors to BuilderValidationError', () => {
    mockedAccountAbstraction.__mocked.revokeSessionKey.mockImplementation(() => {
      throw new Error('Invalid Stellar public key: expected a G… address, received "BADKEY"');
    });

    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.revokeSessionKey({
        ...params,
        publicKey: 'BADKEY',
      })
    ).toThrow(BuilderValidationError);
  });

  it('rejects malformed public parameters before delegation', () => {
    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.revokeSessionKey({
        ...params,
        publicKey: ' ',
      })
    ).toThrow(BuilderValidationError);

    expect(mockedAccountAbstraction.__mocked.revokeSessionKey).not.toHaveBeenCalled();
  });

  it('rejects empty public key before delegation', () => {
    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() =>
      client.revokeSessionKey({
        publicKey: '',
      })
    ).toThrow(BuilderValidationError);

    expect(mockedAccountAbstraction.__mocked.revokeSessionKey).not.toHaveBeenCalled();
  });

  it('rejects null/undefined parameters before delegation', () => {
    const client = new AncoreClient({ accountContractId: CONTRACT_ID });

    expect(() => client.revokeSessionKey(null as any)).toThrow(BuilderValidationError);
    expect(() => client.revokeSessionKey(undefined as any)).toThrow(BuilderValidationError);

    expect(mockedAccountAbstraction.__mocked.revokeSessionKey).not.toHaveBeenCalled();
  });
});
