import { UserOperationSchema, TransactionResultSchema } from '../user-operation';
import { isUserOperation, isTransactionResult } from '../guards';

describe('UserOperation', () => {
  describe('UserOperationSchema', () => {
    test('parses valid UserOperation', () => {
      const op = {
        id: 'op-123',
        type: 'payment',
        operation: { type: 'payment', amount: '100' },
        gasLimit: 1000,
        createdAt: Date.now(),
      };
      const parsed = UserOperationSchema.parse(op);
      expect(parsed.id).toBe('op-123');
      expect(parsed.type).toBe('payment');
      expect(parsed.gasLimit).toBe(1000);
    });

    test('parses UserOperation without optional gasLimit', () => {
      const op = {
        id: 'op-456',
        type: 'invoke',
        operation: { type: 'invokeHostFunction' },
        createdAt: Date.now(),
      };
      const parsed = UserOperationSchema.parse(op);
      expect(parsed.id).toBe('op-456');
      expect(parsed.gasLimit).toBeUndefined();
    });

    test('rejects empty id', () => {
      const op = {
        id: '',
        type: 'payment',
        operation: {},
        createdAt: Date.now(),
      };
      expect(() => UserOperationSchema.parse(op)).toThrow();
    });

    test('rejects negative createdAt', () => {
      const op = {
        id: 'op-789',
        type: 'payment',
        operation: {},
        createdAt: -1,
      };
      expect(() => UserOperationSchema.parse(op)).toThrow();
    });

    test('rejects negative gasLimit', () => {
      const op = {
        id: 'op-999',
        type: 'payment',
        operation: {},
        gasLimit: -100,
        createdAt: Date.now(),
      };
      expect(() => UserOperationSchema.parse(op)).toThrow();
    });
  });

  describe('isUserOperation', () => {
    test('returns true for valid UserOperation', () => {
      const op = {
        id: 'test-op',
        type: 'payment',
        operation: {},
        createdAt: Date.now(),
      };
      expect(isUserOperation(op)).toBe(true);
    });

    test('returns true for UserOperation with gasLimit', () => {
      const op = {
        id: 'test-op',
        type: 'payment',
        operation: { type: 'payment' },
        gasLimit: 5000,
        createdAt: Date.now(),
      };
      expect(isUserOperation(op)).toBe(true);
    });

    test('returns false for null', () => {
      expect(isUserOperation(null)).toBe(false);
    });

    test('returns false for missing id', () => {
      expect(
        isUserOperation({
          type: 'payment',
          operation: {},
          createdAt: Date.now(),
        })
      ).toBe(false);
    });

    test('returns false for missing type', () => {
      expect(
        isUserOperation({
          id: 'test',
          operation: {},
          createdAt: Date.now(),
        })
      ).toBe(false);
    });

    test('returns false for missing operation', () => {
      expect(
        isUserOperation({
          id: 'test',
          type: 'payment',
          createdAt: Date.now(),
        })
      ).toBe(false);
    });

    test('returns false for missing createdAt', () => {
      expect(
        isUserOperation({
          id: 'test',
          type: 'payment',
          operation: {},
        })
      ).toBe(false);
    });

    test('returns false for null operation', () => {
      expect(
        isUserOperation({
          id: 'test',
          type: 'payment',
          operation: null,
          createdAt: Date.now(),
        })
      ).toBe(false);
    });
  });
});

describe('TransactionResult', () => {
  describe('TransactionResultSchema', () => {
    test('parses successful TransactionResult', () => {
      const result = {
        status: 'success',
        hash: 'txabcd1234',
        ledger: 1000,
        timestamp: Date.now(),
      };
      const parsed = TransactionResultSchema.parse(result);
      expect(parsed.status).toBe('success');
      expect(parsed.hash).toBe('txabcd1234');
      expect(parsed.ledger).toBe(1000);
    });

    test('parses failed TransactionResult with error', () => {
      const result = {
        status: 'failure',
        error: 'Insufficient balance',
        timestamp: Date.now(),
      };
      const parsed = TransactionResultSchema.parse(result);
      expect(parsed.status).toBe('failure');
      expect(parsed.error).toBe('Insufficient balance');
    });

    test('parses pending TransactionResult', () => {
      const result = {
        status: 'pending',
        timestamp: Date.now(),
      };
      const parsed = TransactionResultSchema.parse(result);
      expect(parsed.status).toBe('pending');
    });

    test('rejects invalid status', () => {
      const result = {
        status: 'invalid',
        timestamp: Date.now(),
      };
      expect(() => TransactionResultSchema.parse(result)).toThrow();
    });

    test('rejects negative ledger', () => {
      const result = {
        status: 'success',
        ledger: -1,
        timestamp: Date.now(),
      };
      expect(() => TransactionResultSchema.parse(result)).toThrow();
    });

    test('rejects negative timestamp', () => {
      const result = {
        status: 'success',
        timestamp: -1,
      };
      expect(() => TransactionResultSchema.parse(result)).toThrow();
    });
  });

  describe('isTransactionResult', () => {
    test('returns true for valid success result', () => {
      const result = {
        status: 'success',
        hash: 'tx123',
        ledger: 500,
        timestamp: Date.now(),
      };
      expect(isTransactionResult(result)).toBe(true);
    });

    test('returns true for valid failure result', () => {
      const result = {
        status: 'failure',
        error: 'Transaction failed',
        timestamp: Date.now(),
      };
      expect(isTransactionResult(result)).toBe(true);
    });

    test('returns true for valid pending result', () => {
      const result = {
        status: 'pending',
        timestamp: Date.now(),
      };
      expect(isTransactionResult(result)).toBe(true);
    });

    test('returns false for null', () => {
      expect(isTransactionResult(null)).toBe(false);
    });

    test('returns false for missing status', () => {
      expect(
        isTransactionResult({
          hash: 'tx123',
          timestamp: Date.now(),
        })
      ).toBe(false);
    });

    test('returns false for missing timestamp', () => {
      expect(
        isTransactionResult({
          status: 'success',
          hash: 'tx123',
        })
      ).toBe(false);
    });

    test('returns false for invalid status', () => {
      expect(
        isTransactionResult({
          status: 'unknown',
          timestamp: Date.now(),
        })
      ).toBe(false);
    });

    test('returns false for non-numeric ledger', () => {
      expect(
        isTransactionResult({
          status: 'success',
          ledger: 'not-a-number',
          timestamp: Date.now(),
        })
      ).toBe(false);
    });

    test('returns false for non-string hash', () => {
      expect(
        isTransactionResult({
          status: 'success',
          hash: 12345,
          timestamp: Date.now(),
        })
      ).toBe(false);
    });

    test('returns false for non-numeric timestamp', () => {
      expect(
        isTransactionResult({
          status: 'success',
          timestamp: 'not-a-number',
        })
      ).toBe(false);
    });
  });
});
