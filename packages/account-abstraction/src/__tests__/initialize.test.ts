/**
 * Unit tests for initialize() — mocked AccountContract.
 */

import { initialize } from '../initialize';
import { AccountContract } from '../account-contract';
import {
  AlreadyInitializedError,
  ContractInvocationError,
  NotInitializedError,
} from '../errors';

jest.mock('../account-contract', () => {
  const mockInitialize = jest.fn();
  const mockBuildInvokeOperation = jest.fn();
  const MockAccountContract = jest.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    buildInvokeOperation: mockBuildInvokeOperation,
  }));
  return {
    AccountContract: MockAccountContract,
    __mocks: { mockInitialize, mockBuildInvokeOperation, MockAccountContract },
  };
});

const { __mocks } = jest.requireMock('../account-contract') as any;

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const OWNER = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

describe('initialize', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('build-only (no options)', () => {
    it('returns InvocationArgs for initialize', () => {
      const invocation = { method: 'initialize', args: ['<scval>'] };
      __mocks.mockInitialize.mockReturnValue(invocation);

      const result = initialize(CONTRACT_ID, { owner: OWNER });

      expect(__mocks.MockAccountContract).toHaveBeenCalledWith(CONTRACT_ID);
      expect(__mocks.mockInitialize).toHaveBeenCalledWith(OWNER);
      expect(result).toBe(invocation);
    });

    it('accepts an AccountContract instance directly', () => {
      const invocation = { method: 'initialize', args: [] };
      __mocks.mockInitialize.mockReturnValue(invocation);
      const contract = new AccountContract(CONTRACT_ID);

      const result = initialize(contract, { owner: OWNER });

      expect(result).toBe(invocation);
    });

    it('maps AlreadyInitialized contract error', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Already initialized');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(AlreadyInitializedError);
    });

    it('maps generic contract errors to ContractInvocationError', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('host invocation failed');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(ContractInvocationError);
    });
  });

  describe('with options (write result)', () => {
    it('returns AccountContractWriteResult', async () => {
      const invocation = { method: 'initialize', args: [] };
      const operation = { type: 'invokeHostFunction' };
      __mocks.mockInitialize.mockReturnValue(invocation);
      __mocks.mockBuildInvokeOperation.mockReturnValue(operation);

      const options = {} as any;
      const result = await initialize(CONTRACT_ID, { owner: OWNER }, options);

      expect(result).toEqual({ invocation, operation });
    });

    it('maps errors in write path', async () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Already initialized');
      });

      await expect(initialize(CONTRACT_ID, { owner: OWNER }, {} as any)).rejects.toThrow(
        AlreadyInitializedError
      );
    });
  });

  describe('validation', () => {
    it('throws ContractInvocationError for empty owner', () => {
      expect(() => initialize(CONTRACT_ID, { owner: '' })).toThrow(ContractInvocationError);
    });

    it('throws ContractInvocationError for missing params', () => {
      expect(() => initialize(CONTRACT_ID, null as any)).toThrow(ContractInvocationError);
    });
  });
});
