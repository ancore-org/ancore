/**
 * Unit tests for execute integration.
 * Tests XDR encoding, contract execution, and error mapping.
 */

import { xdr, nativeToScVal } from '@stellar/stellar-sdk';
import { AccountContract } from '../account-contract';
import { encodeContractArgs, parseExecuteResult } from '../execute';
import { mapContractError } from '../errors';

describe('execute integration', () => {
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
  let contract: AccountContract;

  beforeEach(() => {
    contract = new AccountContract(contractId);
  });

  describe('encodeContractArgs', () => {
    it('should encode basic types', () => {
      const args = ['hello', 42, true, null];
      const encoded = encodeContractArgs(args);

      expect(encoded).toHaveLength(4);
      expect(encoded[0]).toEqual(nativeToScVal('hello'));
      expect(encoded[1]).toEqual(nativeToScVal(42));
      expect(encoded[2]).toEqual(nativeToScVal(true));
      expect(encoded[3]).toEqual(xdr.ScVal.scvVoid());
    });

    it('should encode arrays and objects', () => {
      const args = [[1, 2, 3], { key: 'value' }];
      const encoded = encodeContractArgs(args);

      expect(encoded).toHaveLength(2);
      expect(encoded[0]).toEqual(nativeToScVal([1, 2, 3]));
      expect(encoded[1]).toEqual(nativeToScVal({ key: 'value' }));
    });

    it('should handle undefined as void', () => {
      const args = [undefined];
      const encoded = encodeContractArgs(args);

      expect(encoded).toHaveLength(1);
      expect(encoded[0]).toEqual(xdr.ScVal.scvVoid());
    });

    it('should throw on encoding errors', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => encodeContractArgs([circular])).toThrow(/Converting circular structure to JSON/);
    });
  });

  describe('parseExecuteResult', () => {
    it('should parse basic types', () => {
      const stringVal = nativeToScVal('hello');
      const numberVal = nativeToScVal(42);
      const boolVal = nativeToScVal(true);

      expect(parseExecuteResult(stringVal)).toBe('hello');
      expect(parseExecuteResult(numberVal)).toBe(42n); // Numbers become BigInt
      expect(parseExecuteResult(boolVal)).toBe(true);
    });

    it('should parse complex types', () => {
      const arrayVal = nativeToScVal([1, 2, 3]);
      const objectVal = nativeToScVal({ key: 'value' });

      expect(parseExecuteResult(arrayVal)).toEqual([1n, 2n, 3n]); // Numbers become BigInt
      expect(parseExecuteResult(objectVal)).toEqual({ key: 'value' });
    });

    it('should throw on parsing errors', () => {
      const invalidScVal = {} as unknown as xdr.ScVal;

      expect(() => parseExecuteResult(invalidScVal)).toThrow(/Failed to parse contract result/);
    });
  });

  describe('error mapping integration', () => {
    it('should map contract-specific errors correctly', () => {
      const testCases = [
        { message: 'Already initialized', expectedError: 'AlreadyInitializedError' },
        { message: 'Not initialized', expectedError: 'NotInitializedError' },
        { message: 'Invalid nonce', expectedError: 'InvalidNonceError' },
        { message: 'unauthorized access', expectedError: 'UnauthorizedError' },
        { message: 'unknown error', expectedError: 'ContractInvocationError' },
      ];

      testCases.forEach(({ message, expectedError }) => {
        const mappedError = mapContractError(message, new Error(message));
        expect(mappedError.constructor.name).toBe(expectedError);
      });
    });
  });

  describe('AccountContract integration methods', () => {
    it('should have executeContract method', () => {
      expect(typeof contract.executeContract).toBe('function');
    });

    it('should have simulateExecute method', () => {
      expect(typeof contract.simulateExecute).toBe('function');
    });

    it('should build execute invocation correctly', () => {
      const invocation = contract.execute(
        'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
        'transfer',
        [
          nativeToScVal('GCKFBEIYTKP6RCZX6DSQF22OLNXY2SOGLVUQ6RGE4VW6HKPOLJZX6YTV'),
          nativeToScVal(1000),
        ],
        1
      );

      expect(invocation.method).toBe('execute');
      expect(invocation.args).toHaveLength(6);
    });
  });
});
