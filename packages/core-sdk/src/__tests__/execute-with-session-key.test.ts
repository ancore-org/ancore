import { xdr } from '@stellar/stellar-sdk';
import { mapExecuteWithSessionKeyError, AncoreClient } from '../execute-with-session-key';
import {
  AncoreSdkError,
  SessionKeyExecutionError,
  SessionKeyExecutionValidationError,
} from '../errors';

// Mock account-abstraction to avoid full contract setup
jest.mock('@ancore/account-abstraction', () => {
  class AccountContractError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'AccountContractError';
    }
  }
  class UnauthorizedError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'UnauthorizedError';
    }
  }
  class InvalidNonceError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'InvalidNonceError';
    }
  }
  class NotInitializedError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'NotInitializedError';
    }
  }
  return {
    AccountContractError,
    UnauthorizedError,
    InvalidNonceError,
    NotInitializedError,
    AccountContract: class {
      execute() {
        return {};
      }
    },
  };
});

// Pull the mocked classes out for use in tests
const { UnauthorizedError, InvalidNonceError, NotInitializedError, AccountContractError } =
  jest.requireMock('@ancore/account-abstraction');

describe('mapExecuteWithSessionKeyError', () => {
  it('passes through AncoreSdkError unchanged', () => {
    const err = new SessionKeyExecutionError('SESSION_KEY_EXECUTION_FAILED', 'already sdk error');
    expect(mapExecuteWithSessionKeyError(err)).toBe(err);
  });

  it('maps UnauthorizedError to SESSION_KEY_EXECUTION_UNAUTHORIZED', () => {
    const err = new UnauthorizedError('not allowed');
    const result = mapExecuteWithSessionKeyError(err);
    expect(result).toBeInstanceOf(SessionKeyExecutionError);
    expect((result as SessionKeyExecutionError).code).toBe('SESSION_KEY_EXECUTION_UNAUTHORIZED');
  });

  it('maps InvalidNonceError to SESSION_KEY_EXECUTION_INVALID_NONCE', () => {
    const err = new InvalidNonceError('bad nonce');
    const result = mapExecuteWithSessionKeyError(err);
    expect(result).toBeInstanceOf(SessionKeyExecutionError);
    expect((result as SessionKeyExecutionError).code).toBe('SESSION_KEY_EXECUTION_INVALID_NONCE');
  });

  it('maps NotInitializedError to SESSION_KEY_EXECUTION_NOT_INITIALIZED', () => {
    const err = new NotInitializedError('not init');
    const result = mapExecuteWithSessionKeyError(err);
    expect(result).toBeInstanceOf(SessionKeyExecutionError);
    expect((result as SessionKeyExecutionError).code).toBe('SESSION_KEY_EXECUTION_NOT_INITIALIZED');
  });

  it('maps AccountContractError to SESSION_KEY_EXECUTION_CONTRACT', () => {
    const err = new AccountContractError('contract error');
    const result = mapExecuteWithSessionKeyError(err);
    expect(result).toBeInstanceOf(SessionKeyExecutionError);
    expect((result as SessionKeyExecutionError).code).toBe('SESSION_KEY_EXECUTION_CONTRACT');
  });

  it('maps generic Error to SESSION_KEY_EXECUTION_FAILED', () => {
    const err = new Error('unexpected');
    const result = mapExecuteWithSessionKeyError(err);
    expect(result).toBeInstanceOf(SessionKeyExecutionError);
    expect((result as SessionKeyExecutionError).code).toBe('SESSION_KEY_EXECUTION_FAILED');
  });

  it('maps unknown non-Error to SESSION_KEY_EXECUTION_FAILED', () => {
    const result = mapExecuteWithSessionKeyError('string error');
    expect(result).toBeInstanceOf(SessionKeyExecutionError);
    expect((result as SessionKeyExecutionError).code).toBe('SESSION_KEY_EXECUTION_FAILED');
  });
});
