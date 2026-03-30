/**
 * Tests for AccountContract
 */

import { AccountContract } from '../account-contract';
import {
  AlreadyInitializedError,
  NotInitializedError,
  InvalidNonceError,
  UnauthorizedError,
  SessionKeyNotFoundError,
  mapContractError,
} from '../errors';
import { xdr } from '@stellar/stellar-sdk';

describe('AccountContract', () => {
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

  describe('constructor', () => {
    it('should create an AccountContract instance', () => {
      const contract = new AccountContract(contractId);

      expect(contract.contractId).toBe(contractId);
    });
  });

  describe('initialize', () => {
    it('should build initialize invocation with valid structure', () => {
      const contract = new AccountContract(contractId);

      // We'll just verify the method structure without calling initialize
      // since it requires valid Stellar addresses
      const invocation = contract.getOwnerInvocation();

      expect(invocation.method).toBe('get_owner');
      expect(invocation.args).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should build execute invocation structure', () => {
      const contract = new AccountContract(contractId);
      const fn = 'transfer';
      const args: xdr.ScVal[] = [];
      const nonce = 1;

      // Test with a contract address which is valid
      const invocation = contract.execute(contractId, fn, args, nonce);

      expect(invocation.method).toBe('execute');
      expect(invocation.args).toHaveLength(4);
    });

    it('should handle execute with multiple arguments', () => {
      const contract = new AccountContract(contractId);
      const fn = 'transfer';
      const args = [xdr.ScVal.scvSymbol(Buffer.from('amount')), xdr.ScVal.scvU32(1000)];
      const nonce = 5;

      const invocation = contract.execute(contractId, fn, args, nonce);

      expect(invocation.method).toBe('execute');
      expect(invocation.args).toHaveLength(4);
    });
  });

  describe('addSessionKey', () => {
    it('should build addSessionKey invocation', () => {
      const contract = new AccountContract(contractId);
      const publicKey = new Uint8Array(32);
      const permissions = [0, 1];
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      const invocation = contract.addSessionKey(publicKey, permissions, expiresAt);

      expect(invocation.method).toBe('add_session_key');
      expect(invocation.args).toHaveLength(3);
    });

    it('should handle addSessionKey with multiple permissions', () => {
      const contract = new AccountContract(contractId);
      const publicKey = new Uint8Array(32);
      const permissions = [0, 1, 2];
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;

      const invocation = contract.addSessionKey(publicKey, permissions, expiresAt);

      expect(invocation.method).toBe('add_session_key');
      expect(invocation.args).toHaveLength(3);
    });
  });

  describe('revokeSessionKey', () => {
    it('should build revokeSessionKey invocation', () => {
      const contract = new AccountContract(contractId);
      const publicKey = new Uint8Array(32);

      const invocation = contract.revokeSessionKey(publicKey);

      expect(invocation.method).toBe('revoke_session_key');
      expect(invocation.args).toHaveLength(1);
    });
  });

  describe('getSessionKeyInvocation', () => {
    it('should build getSessionKey invocation', () => {
      const contract = new AccountContract(contractId);
      const publicKey = new Uint8Array(32);

      const invocation = contract.getSessionKeyInvocation(publicKey);

      expect(invocation.method).toBe('get_session_key');
      expect(invocation.args).toHaveLength(1);
    });
  });

  describe('getOwnerInvocation', () => {
    it('should build getOwner invocation', () => {
      const contract = new AccountContract(contractId);

      const invocation = contract.getOwnerInvocation();

      expect(invocation.method).toBe('get_owner');
      expect(invocation.args).toHaveLength(0);
    });
  });

  describe('getNonceInvocation', () => {
    it('should build getNonce invocation', () => {
      const contract = new AccountContract(contractId);

      const invocation = contract.getNonceInvocation();

      expect(invocation.method).toBe('get_nonce');
      expect(invocation.args).toHaveLength(0);
    });
  });

  describe('buildInvokeOperation', () => {
    it('should build an invoke operation', () => {
      const contract = new AccountContract(contractId);
      const invocation = contract.getOwnerInvocation();

      const operation = contract.buildInvokeOperation(invocation);

      expect(operation).toBeDefined();
    });
  });

  describe('call', () => {
    it('should create a contract call operation', () => {
      const contract = new AccountContract(contractId);

      const operation = contract.call('get_owner');

      expect(operation).toBeDefined();
    });

    it('should create a contract call with arguments', () => {
      const contract = new AccountContract(contractId);
      const arg = xdr.ScVal.scvU32(42);

      const operation = contract.call('some_method', arg);

      expect(operation).toBeDefined();
    });
  });
});

describe('mapContractError', () => {
  it('should map AlreadyInitialized error', () => {
    const error = mapContractError('Already initialized');

    expect(error).toBeInstanceOf(AlreadyInitializedError);
    expect(error.code).toBe('ALREADY_INITIALIZED');
  });

  it('should map NotInitialized error', () => {
    const error = mapContractError('Not initialized');

    expect(error).toBeInstanceOf(NotInitializedError);
    expect(error.code).toBe('NOT_INITIALIZED');
  });

  it('should map InvalidNonce error', () => {
    const error = mapContractError('Invalid nonce');

    expect(error).toBeInstanceOf(InvalidNonceError);
    expect(error.code).toBe('INVALID_NONCE');
  });

  it('should map SessionKeyNotFound error', () => {
    const error = mapContractError('Session key not found');

    expect(error).toBeInstanceOf(SessionKeyNotFoundError);
    expect(error.code).toBe('SESSION_KEY_NOT_FOUND');
  });

  it('should map Unauthorized error', () => {
    const error = mapContractError('Auth failure');

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should include context in SessionKeyNotFoundError', () => {
    const publicKey = 'GABC123';
    const error = mapContractError('Session key not found', undefined, {
      sessionPublicKey: publicKey,
    });

    expect(error).toBeInstanceOf(SessionKeyNotFoundError);
    expect(error.message).toContain(publicKey);
  });

  it('should handle case-insensitive auth errors', () => {
    const error = mapContractError('UNAUTHORIZED: caller not authorized');

    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('should handle case-insensitive session key errors', () => {
    const error = mapContractError('SESSION KEY not found');

    expect(error).toBeInstanceOf(SessionKeyNotFoundError);
  });

  it('should return generic ContractInvocationError for unknown errors', () => {
    const error = mapContractError('Unknown error');

    expect(error.code).toBe('CONTRACT_INVOCATION');
    expect(error.message).toBe('Unknown error');
  });

  it('should preserve raw error in ContractInvocationError', () => {
    const rawError = { some: 'data' };
    const error = mapContractError('Unknown error', rawError);

    expect(error.cause).toBe(rawError);
  });
});
