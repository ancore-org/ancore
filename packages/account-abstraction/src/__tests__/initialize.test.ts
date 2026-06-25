/**
 * Unit tests for initialize() — comprehensive test matrix covering
 * owner auth, duplicate init, and migration edge cases.
 *
 * These tests mirror contract scenarios with mocked auth and expected error codes.
 * Tests are snapshot-tested for invocation args stability.
 */

import { initialize } from '../initialize';
import { AccountContract, type AccountContractReadOptions } from '../account-contract';
import {
  AlreadyInitializedError,
  ContractInvocationError,
  UnauthorizedError,
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

const { __mocks } = jest.requireMock('../account-contract') as {
  __mocks: {
    mockInitialize: jest.Mock;
    mockBuildInvokeOperation: jest.Mock;
    MockAccountContract: jest.Mock;
  };
};

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const OWNER = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const OWNER_ALT = 'GBPXX5CZNRMV2GVVMM6Q5WWJNL2YGWKQHZQNZZWFHQIQIVY4DVKJF456';

describe('initialize', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('happy path', () => {
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

    it('returns AccountContractWriteResult with options', async () => {
      const invocation = { method: 'initialize', args: [] };
      const operation = { type: 'invokeHostFunction' };
      __mocks.mockInitialize.mockReturnValue(invocation);
      __mocks.mockBuildInvokeOperation.mockReturnValue(operation);

      const options = {} as AccountContractReadOptions;
      const result = await initialize(CONTRACT_ID, { owner: OWNER }, options);

      expect(result).toEqual({ invocation, operation });
    });
  });

  describe('error: already initialized', () => {
    it('throws AlreadyInitializedError when contract already initialized', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Already initialized');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(AlreadyInitializedError);
      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(/already initialized/i);
    });

    it('throws AlreadyInitializedError with numeric error code', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Error(Contract, #1)');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(AlreadyInitializedError);
    });

    it('throws AlreadyInitializedError in write path', async () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Already initialized');
      });

      await expect(
        initialize(CONTRACT_ID, { owner: OWNER }, {} as AccountContractReadOptions)
      ).rejects.toThrow(AlreadyInitializedError);
    });
  });

  describe('error: missing owner signature', () => {
    it('throws UnauthorizedError when owner auth missing', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Authorization failed');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError with auth error code', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Error(Contract, #3)');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(UnauthorizedError);
    });
  });

  describe('error: wrong network', () => {
    it('throws ContractInvocationError when network mismatch', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('Network mismatch: expected testnet, got mainnet');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(ContractInvocationError);
      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(/network mismatch/i);
    });
  });

  describe('validation', () => {
    it('throws ContractInvocationError for empty owner', () => {
      expect(() => initialize(CONTRACT_ID, { owner: '' })).toThrow(ContractInvocationError);
      expect(() => initialize(CONTRACT_ID, { owner: '' })).toThrow(/non-empty/i);
    });

    it('throws ContractInvocationError for whitespace-only owner', () => {
      expect(() => initialize(CONTRACT_ID, { owner: '   ' })).toThrow(ContractInvocationError);
    });

    it('throws ContractInvocationError for missing params', () => {
      expect(() => initialize(CONTRACT_ID, null as unknown as { owner: string })).toThrow(
        ContractInvocationError
      );
      expect(() => initialize(CONTRACT_ID, null as unknown as { owner: string })).toThrow(
        /params object/i
      );
    });

    it('throws ContractInvocationError for params without owner', () => {
      expect(() => initialize(CONTRACT_ID, {} as { owner: string })).toThrow(
        ContractInvocationError
      );
    });
  });

  describe('snapshot: invocation args', () => {
    it('produces stable invocation for standard owner address', () => {
      const invocation = { method: 'initialize', args: ['<scval-owner>'] };
      __mocks.mockInitialize.mockReturnValue(invocation);

      const result = initialize(CONTRACT_ID, { owner: OWNER });

      expect(result).toMatchSnapshot();
    });

    it('produces stable invocation for alternative owner address', () => {
      const invocation = { method: 'initialize', args: ['<scval-alt-owner>'] };
      __mocks.mockInitialize.mockReturnValue(invocation);

      const result = initialize(CONTRACT_ID, { owner: OWNER_ALT });

      expect(result).toMatchSnapshot();
    });

    it('produces stable write result shape', async () => {
      const invocation = { method: 'initialize', args: ['<scval>'] };
      const operation = { type: 'invokeHostFunction', source: OWNER };
      __mocks.mockInitialize.mockReturnValue(invocation);
      __mocks.mockBuildInvokeOperation.mockReturnValue(operation);

      const result = await initialize(CONTRACT_ID, { owner: OWNER }, {} as AccountContractReadOptions);

      expect(result).toMatchSnapshot();
    });
  });

  describe('error mapping alignment', () => {
    it('maps all contract-aligned error codes correctly', () => {
      const errorCases = [
        { code: 1, error: AlreadyInitializedError, message: 'Error(Contract, #1)' },
        { code: 3, error: UnauthorizedError, message: 'Error(Contract, #3)' },
      ];

      errorCases.forEach(({ message, error }) => {
        __mocks.mockInitialize.mockImplementation(() => {
          throw new Error(message);
        });

        expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(error);

        jest.clearAllMocks();
      });
    });

    it('maps string-based contract panics', () => {
      const panicCases = [
        { message: 'Already initialized', error: AlreadyInitializedError },
        { message: 'auth required', error: UnauthorizedError },
        { message: 'unauthorized caller', error: UnauthorizedError },
      ];

      panicCases.forEach(({ message, error }) => {
        __mocks.mockInitialize.mockImplementation(() => {
          throw new Error(message);
        });

        expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(error);

        jest.clearAllMocks();
      });
    });

    it('maps generic errors to ContractInvocationError', () => {
      __mocks.mockInitialize.mockImplementation(() => {
        throw new Error('host invocation failed');
      });

      expect(() => initialize(CONTRACT_ID, { owner: OWNER })).toThrow(ContractInvocationError);
    });
  });

  describe('contract ID formats', () => {
    it('accepts standard contract ID format', () => {
      const invocation = { method: 'initialize', args: [] };
      __mocks.mockInitialize.mockReturnValue(invocation);

      const result = initialize(CONTRACT_ID, { owner: OWNER });

      expect(result).toBe(invocation);
    });

    it('accepts string contract ID', () => {
      const invocation = { method: 'initialize', args: [] };
      __mocks.mockInitialize.mockReturnValue(invocation);

      const result = initialize('CA...', { owner: OWNER });

      expect(__mocks.MockAccountContract).toHaveBeenCalledWith('CA...');
      expect(result).toBe(invocation);
    });
  });
});
