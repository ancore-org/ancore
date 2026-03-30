/**
 * Unit tests for revokeSessionKey() — mocked AccountContract.
 */

import { revokeSessionKey } from '../revoke-session-key';
import { AccountContract } from '../account-contract';
import { SessionKeyNotFoundError, UnauthorizedError, ContractInvocationError } from '../errors';

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

const { __mocks } = jest.requireMock('../account-contract') as any;

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const SESSION_KEY = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

describe('revokeSessionKey', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('build-only (no options)', () => {
    it('returns InvocationArgs for revoke_session_key', () => {
      const invocation = { method: 'revoke_session_key', args: ['<scval>'] };
      __mocks.mockRevokeSessionKey.mockReturnValue(invocation);

      const result = revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY });

      expect(__mocks.MockAccountContract).toHaveBeenCalledWith(CONTRACT_ID);
      expect(__mocks.mockRevokeSessionKey).toHaveBeenCalledWith(SESSION_KEY);
      expect(result).toBe(invocation);
    });

    it('accepts Uint8Array public key', () => {
      const invocation = { method: 'revoke_session_key', args: [] };
      __mocks.mockRevokeSessionKey.mockReturnValue(invocation);
      const key = new Uint8Array(32);

      const result = revokeSessionKey(CONTRACT_ID, { publicKey: key });

      expect(__mocks.mockRevokeSessionKey).toHaveBeenCalledWith(key);
      expect(result).toBe(invocation);
    });

    it('accepts an AccountContract instance directly', () => {
      const invocation = { method: 'revoke_session_key', args: [] };
      __mocks.mockRevokeSessionKey.mockReturnValue(invocation);
      const contract = new AccountContract(CONTRACT_ID);

      const result = revokeSessionKey(contract, { publicKey: SESSION_KEY });

      expect(result).toBe(invocation);
    });

    it('maps SessionKeyNotFound contract error', () => {
      __mocks.mockRevokeSessionKey.mockImplementation(() => {
        throw new Error('Session key not found');
      });

      expect(() => revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY })).toThrow(
        SessionKeyNotFoundError
      );
    });

    it('maps Unauthorized contract error', () => {
      __mocks.mockRevokeSessionKey.mockImplementation(() => {
        throw new Error('Auth failure: unauthorized');
      });

      expect(() => revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY })).toThrow(
        UnauthorizedError
      );
    });

    it('maps generic errors to ContractInvocationError', () => {
      __mocks.mockRevokeSessionKey.mockImplementation(() => {
        throw new Error('host invocation failed');
      });

      expect(() => revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY })).toThrow(
        ContractInvocationError
      );
    });

    it('maps non-Error throwables to ContractInvocationError', () => {
      __mocks.mockRevokeSessionKey.mockImplementation(() => {
        throw 'boom';
      });

      expect(() => revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY })).toThrow(
        ContractInvocationError
      );
    });
  });

  describe('with options (write result)', () => {
    it('returns AccountContractWriteResult', async () => {
      const invocation = { method: 'revoke_session_key', args: [] };
      const operation = { type: 'invokeHostFunction' };
      __mocks.mockRevokeSessionKey.mockReturnValue(invocation);
      __mocks.mockBuildInvokeOperation.mockReturnValue(operation);

      const result = await revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY }, {} as any);

      expect(result).toEqual({ invocation, operation });
    });

    it('maps errors in write path', async () => {
      __mocks.mockRevokeSessionKey.mockImplementation(() => {
        throw new Error('Session key not found');
      });

      await expect(
        revokeSessionKey(CONTRACT_ID, { publicKey: SESSION_KEY }, {} as any)
      ).rejects.toThrow(SessionKeyNotFoundError);
    });
  });

  describe('validation', () => {
    it('throws ContractInvocationError for empty publicKey string', () => {
      expect(() => revokeSessionKey(CONTRACT_ID, { publicKey: '' })).toThrow(
        ContractInvocationError
      );
    });

    it('throws ContractInvocationError for missing params', () => {
      expect(() => revokeSessionKey(CONTRACT_ID, null as any)).toThrow(ContractInvocationError);
    });
  });
});
