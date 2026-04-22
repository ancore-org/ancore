/**
 * Comprehensive unit tests for typed error classes and error mapping.
 */

import {
  AccountContractError,
  AlreadyInitializedError,
  NotInitializedError,
  InvalidNonceError,
  UnauthorizedError,
  SessionKeyNotFoundError,
  SessionKeyExpiredError,
  InsufficientPermissionError,
  ContractInvocationError,
  mapContractError,
  CONTRACT_ERROR_MESSAGES,
  CONTRACT_ERROR_CODES,
} from '../index';

describe('Typed error classes', () => {
  describe('AccountContractError (base)', () => {
    it('has correct name, message, and default code', () => {
      const err = new AccountContractError('test message');
      expect(err.name).toBe('AccountContractError');
      expect(err.message).toBe('test message');
      expect(err.code).toBe('ACCOUNT_CONTRACT_ERROR');
    });

    it('accepts a custom code', () => {
      const err = new AccountContractError('msg', 'CUSTOM');
      expect(err.code).toBe('CUSTOM');
    });

    it('is an instance of Error', () => {
      const err = new AccountContractError('msg');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AccountContractError);
    });
  });

  describe('AlreadyInitializedError', () => {
    const err = new AlreadyInitializedError();

    it('has correct name and code', () => {
      expect(err.name).toBe('AlreadyInitializedError');
      expect(err.code).toBe('ALREADY_INITIALIZED');
    });

    it('extends AccountContractError and Error', () => {
      expect(err).toBeInstanceOf(AccountContractError);
      expect(err).toBeInstanceOf(Error);
    });

    it('has a descriptive message', () => {
      expect(err.message).toContain('already initialized');
    });
  });

  describe('NotInitializedError', () => {
    const err = new NotInitializedError();

    it('has correct name and code', () => {
      expect(err.name).toBe('NotInitializedError');
      expect(err.code).toBe('NOT_INITIALIZED');
    });

    it('extends AccountContractError', () => {
      expect(err).toBeInstanceOf(AccountContractError);
    });
  });

  describe('InvalidNonceError', () => {
    it('has correct name and code with default message', () => {
      const err = new InvalidNonceError();
      expect(err.name).toBe('InvalidNonceError');
      expect(err.code).toBe('INVALID_NONCE');
      expect(err.message).toContain('nonce');
    });

    it('accepts a custom message', () => {
      const err = new InvalidNonceError('nonce was 5, expected 6');
      expect(err.message).toBe('nonce was 5, expected 6');
    });

    it('extends AccountContractError', () => {
      expect(new InvalidNonceError()).toBeInstanceOf(AccountContractError);
    });
  });

  describe('UnauthorizedError', () => {
    it('has correct name and code', () => {
      const err = new UnauthorizedError();
      expect(err.name).toBe('UnauthorizedError');
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('accepts a custom message', () => {
      const err = new UnauthorizedError('require_auth failed');
      expect(err.message).toBe('require_auth failed');
    });

    it('extends AccountContractError', () => {
      expect(new UnauthorizedError()).toBeInstanceOf(AccountContractError);
    });
  });

  describe('SessionKeyNotFoundError', () => {
    it('has correct name and code', () => {
      const err = new SessionKeyNotFoundError();
      expect(err.name).toBe('SessionKeyNotFoundError');
      expect(err.code).toBe('SESSION_KEY_NOT_FOUND');
    });

    it('includes publicKey in message when provided', () => {
      const err = new SessionKeyNotFoundError('GABC...');
      expect(err.message).toContain('GABC...');
    });

    it('has generic message when no publicKey', () => {
      const err = new SessionKeyNotFoundError();
      expect(err.message).toBe('Session key not found');
    });

    it('extends AccountContractError', () => {
      expect(new SessionKeyNotFoundError()).toBeInstanceOf(AccountContractError);
    });
  });

  describe('SessionKeyExpiredError', () => {
    it('has correct name and code', () => {
      const err = new SessionKeyExpiredError();
      expect(err.name).toBe('SessionKeyExpiredError');
      expect(err.code).toBe('SESSION_KEY_EXPIRED');
    });

    it('has a descriptive default message', () => {
      const err = new SessionKeyExpiredError();
      expect(err.message).toContain('expired');
    });

    it('accepts a custom message', () => {
      const err = new SessionKeyExpiredError('key expired at ledger 500');
      expect(err.message).toBe('key expired at ledger 500');
    });

    it('extends AccountContractError', () => {
      expect(new SessionKeyExpiredError()).toBeInstanceOf(AccountContractError);
    });
  });

  describe('InsufficientPermissionError', () => {
    it('has correct name and code', () => {
      const err = new InsufficientPermissionError();
      expect(err.name).toBe('InsufficientPermissionError');
      expect(err.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('has a descriptive default message', () => {
      const err = new InsufficientPermissionError();
      expect(err.message).toContain('permission');
    });

    it('accepts a custom message', () => {
      const err = new InsufficientPermissionError('missing transfer permission');
      expect(err.message).toBe('missing transfer permission');
    });

    it('extends AccountContractError', () => {
      expect(new InsufficientPermissionError()).toBeInstanceOf(AccountContractError);
    });
  });

  describe('ContractInvocationError', () => {
    it('has correct name and code', () => {
      const err = new ContractInvocationError('unexpected');
      expect(err.name).toBe('ContractInvocationError');
      expect(err.code).toBe('CONTRACT_INVOCATION');
    });

    it('stores raw cause', () => {
      const raw = { error: 'something', code: 500 };
      const err = new ContractInvocationError('fail', raw);
      expect(err.cause).toBe(raw);
    });

    it('cause is undefined when not provided', () => {
      const err = new ContractInvocationError('fail');
      expect(err.cause).toBeUndefined();
    });

    it('extends AccountContractError', () => {
      expect(new ContractInvocationError('fail')).toBeInstanceOf(AccountContractError);
    });
  });
});

describe('CONTRACT_ERROR_MESSAGES', () => {
  it('contains all known panic messages', () => {
    expect(CONTRACT_ERROR_MESSAGES.ALREADY_INITIALIZED).toBe('Already initialized');
    expect(CONTRACT_ERROR_MESSAGES.NOT_INITIALIZED).toBe('Not initialized');
    expect(CONTRACT_ERROR_MESSAGES.INVALID_NONCE).toBe('Invalid nonce');
    expect(CONTRACT_ERROR_MESSAGES.SESSION_KEY_EXPIRED).toBe('Session key expired');
    expect(CONTRACT_ERROR_MESSAGES.INSUFFICIENT_PERMISSION).toBe('Insufficient permission');
  });
});

describe('CONTRACT_ERROR_CODES', () => {
  it('maps all 7 contract error codes', () => {
    expect(Object.keys(CONTRACT_ERROR_CODES)).toHaveLength(7);
  });

  it('code 1 → AlreadyInitializedError', () => {
    expect(CONTRACT_ERROR_CODES[1]()).toBeInstanceOf(AlreadyInitializedError);
  });

  it('code 2 → NotInitializedError', () => {
    expect(CONTRACT_ERROR_CODES[2]()).toBeInstanceOf(NotInitializedError);
  });

  it('code 3 → UnauthorizedError', () => {
    expect(CONTRACT_ERROR_CODES[3]()).toBeInstanceOf(UnauthorizedError);
  });

  it('code 4 → InvalidNonceError', () => {
    expect(CONTRACT_ERROR_CODES[4]()).toBeInstanceOf(InvalidNonceError);
  });

  it('code 5 → SessionKeyNotFoundError', () => {
    expect(CONTRACT_ERROR_CODES[5]()).toBeInstanceOf(SessionKeyNotFoundError);
  });

  it('code 6 → SessionKeyExpiredError', () => {
    expect(CONTRACT_ERROR_CODES[6]()).toBeInstanceOf(SessionKeyExpiredError);
  });

  it('code 7 → InsufficientPermissionError', () => {
    expect(CONTRACT_ERROR_CODES[7]()).toBeInstanceOf(InsufficientPermissionError);
  });
});

describe('mapContractError', () => {
  describe('numeric Soroban error codes (Error(Contract, #N))', () => {
    it('maps Error(Contract, #1) to AlreadyInitializedError', () => {
      const err = mapContractError('HostError: Error(Contract, #1)');
      expect(err).toBeInstanceOf(AlreadyInitializedError);
    });

    it('maps Error(Contract, #2) to NotInitializedError', () => {
      const err = mapContractError('HostError: Error(Contract, #2)');
      expect(err).toBeInstanceOf(NotInitializedError);
    });

    it('maps Error(Contract, #3) to UnauthorizedError', () => {
      const err = mapContractError('HostError: Error(Contract, #3)');
      expect(err).toBeInstanceOf(UnauthorizedError);
    });

    it('maps Error(Contract, #4) to InvalidNonceError', () => {
      const err = mapContractError('HostError: Error(Contract, #4)');
      expect(err).toBeInstanceOf(InvalidNonceError);
    });

    it('maps Error(Contract, #5) to SessionKeyNotFoundError', () => {
      const err = mapContractError('HostError: Error(Contract, #5)');
      expect(err).toBeInstanceOf(SessionKeyNotFoundError);
    });

    it('maps Error(Contract, #6) to SessionKeyExpiredError', () => {
      const err = mapContractError('HostError: Error(Contract, #6)');
      expect(err).toBeInstanceOf(SessionKeyExpiredError);
    });

    it('maps Error(Contract, #7) to InsufficientPermissionError', () => {
      const err = mapContractError('HostError: Error(Contract, #7)');
      expect(err).toBeInstanceOf(InsufficientPermissionError);
    });

    it('falls through to string matching for unknown numeric codes', () => {
      const err = mapContractError('HostError: Error(Contract, #99)');
      expect(err).toBeInstanceOf(ContractInvocationError);
    });

    it('handles spacing variations in Error(Contract, #N)', () => {
      const err = mapContractError('Error(Contract,#3)');
      expect(err).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('string-based panic message matching', () => {
    it('maps "Already initialized" to AlreadyInitializedError', () => {
      const err = mapContractError('Host error: Already initialized');
      expect(err).toBeInstanceOf(AlreadyInitializedError);
    });

    it('maps "Not initialized" to NotInitializedError', () => {
      const err = mapContractError('Contract panic: Not initialized');
      expect(err).toBeInstanceOf(NotInitializedError);
    });

    it('maps "Invalid nonce" to InvalidNonceError', () => {
      const err = mapContractError('Transaction failed: Invalid nonce');
      expect(err).toBeInstanceOf(InvalidNonceError);
      expect(err.message).toContain('Invalid nonce');
    });

    it('maps "Session key expired" to SessionKeyExpiredError', () => {
      const err = mapContractError('session key expired at ledger 100');
      expect(err).toBeInstanceOf(SessionKeyExpiredError);
    });

    it('maps "Insufficient permission" to InsufficientPermissionError', () => {
      const err = mapContractError('Insufficient permission for transfer');
      expect(err).toBeInstanceOf(InsufficientPermissionError);
    });

    it('maps auth-related messages to UnauthorizedError', () => {
      expect(mapContractError('require_auth failed')).toBeInstanceOf(UnauthorizedError);
      expect(mapContractError('Unauthorized access')).toBeInstanceOf(UnauthorizedError);
      expect(mapContractError('authentication failed')).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('fallback behavior', () => {
    it('returns ContractInvocationError for unknown messages', () => {
      const err = mapContractError('Something completely unexpected');
      expect(err).toBeInstanceOf(ContractInvocationError);
      expect(err.message).toBe('Something completely unexpected');
    });

    it('preserves raw cause in ContractInvocationError', () => {
      const raw = { status: 'FAILED', details: 'out of gas' };
      const err = mapContractError('Transaction failed', raw);
      expect(err).toBeInstanceOf(ContractInvocationError);
      expect((err as ContractInvocationError).cause).toBe(raw);
    });
  });

  describe('priority: numeric codes take precedence over string matching', () => {
    it('numeric code wins even when message also contains matching text', () => {
      // Code #3 = Unauthorized, but message says "Not initialized"
      const err = mapContractError('Error(Contract, #3): Not initialized');
      expect(err).toBeInstanceOf(UnauthorizedError);
    });
  });
});
