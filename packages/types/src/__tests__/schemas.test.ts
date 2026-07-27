import { SmartAccountSchema } from '../smart-account';
import { SessionKeySchema, SessionPermission } from '../session-key';
import { SessionKeyPolicySchema } from '../session-key-policy';

describe('schemas', () => {
  test('SmartAccountSchema parses valid object', () => {
    const now = Date.now();
    const obj = {
      publicKey: 'G' + 'A'.repeat(55),
      contractId: 'C' + 'B'.repeat(55),
      nonce: 0,
      metadata: { name: 'Alice', createdAt: now },
    };
    const parsed = SmartAccountSchema.parse(obj);
    expect(parsed.publicKey).toBe(obj.publicKey);
  });

  test('SmartAccountSchema rejects invalid publicKey', () => {
    const obj = { publicKey: 'BAD', contractId: 'C1', nonce: 0 };
    expect(() => SmartAccountSchema.parse(obj)).toThrow();
  });

  test('SessionKeySchema parses valid key', () => {
    const key = {
      publicKey: 'G' + 'A'.repeat(55),
      permissions: [SessionPermission.SEND_PAYMENT],
      expiresAt: Date.now() + 1000,
    };
    const parsed = SessionKeySchema.parse(key);
    expect(parsed.permissions.length).toBeGreaterThan(0);
  });

  test('SessionKeySchema rejects bad permissions', () => {
    const key = {
      publicKey: 'G' + 'A'.repeat(55),
      permissions: [99],
      expiresAt: Date.now() + 1000,
    };
    expect(() => SessionKeySchema.parse(key)).toThrow();
  });

  describe('SessionKeyPolicySchema', () => {
    test('parses valid policy with all fields', () => {
      const policy = {
        expiresAt: Date.now() + 3600_000,
        permissions: 3,
        allowedContracts: ['C' + 'A'.repeat(55)],
        maxAmountPerCall: '100.50',
      };
      const parsed = SessionKeyPolicySchema.parse(policy);
      expect(parsed.expiresAt).toBe(policy.expiresAt);
      expect(parsed.permissions).toBe(3);
      expect(parsed.allowedContracts).toHaveLength(1);
      expect(parsed.maxAmountPerCall).toBe('100.50');
    });

    test('parses valid policy with only required fields', () => {
      const policy = {
        expiresAt: Date.now() + 3600_000,
        permissions: 0,
      };
      const parsed = SessionKeyPolicySchema.parse(policy);
      expect(parsed.expiresAt).toBeGreaterThan(0);
      expect(parsed.permissions).toBe(0);
      expect(parsed.allowedContracts).toBeUndefined();
      expect(parsed.maxAmountPerCall).toBeUndefined();
    });

    test('rejects non-positive expiresAt', () => {
      const policy = { expiresAt: -1, permissions: 0 };
      expect(() => SessionKeyPolicySchema.parse(policy)).toThrow();
    });

    test('rejects non-integer expiresAt', () => {
      const policy = { expiresAt: 123.45, permissions: 0 };
      expect(() => SessionKeyPolicySchema.parse(policy)).toThrow();
    });

    test('rejects negative permissions', () => {
      const policy = { expiresAt: Date.now() + 1000, permissions: -1 };
      expect(() => SessionKeyPolicySchema.parse(policy)).toThrow();
    });

    test('rejects invalid contract address in allowedContracts', () => {
      const policy = {
        expiresAt: Date.now() + 1000,
        permissions: 0,
        allowedContracts: ['not-a-valid-address'],
      };
      expect(() => SessionKeyPolicySchema.parse(policy)).toThrow();
    });

    test('rejects invalid maxAmountPerCall format', () => {
      const policy = {
        expiresAt: Date.now() + 1000,
        permissions: 0,
        maxAmountPerCall: 'abc',
      };
      expect(() => SessionKeyPolicySchema.parse(policy)).toThrow();
    });

    test('accepts empty allowedContracts', () => {
      const policy = {
        expiresAt: Date.now() + 1000,
        permissions: 0,
        allowedContracts: [],
      };
      const parsed = SessionKeyPolicySchema.parse(policy);
      expect(parsed.allowedContracts).toEqual([]);
    });
  });
});
