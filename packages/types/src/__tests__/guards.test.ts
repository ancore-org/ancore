import { isSmartAccount, isSessionKey, isValidPermission } from '../guards';

describe('guards', () => {
  test('isSmartAccount returns true for valid object', () => {
    const obj = { publicKey: 'G'.padEnd(56, 'A'), contractId: 'C123', nonce: 1 };
    expect(isSmartAccount(obj)).toBe(true);
  });

  test('isSmartAccount returns false for invalid', () => {
    expect(isSmartAccount(null)).toBe(false);
    expect(isSmartAccount({})).toBe(false);
  });

  test('isSessionKey returns true for valid object', () => {
    const obj = { publicKey: 'G'.padEnd(56, 'A'), permissions: [0], expiresAt: Date.now() };
    expect(isSessionKey(obj)).toBe(true);
  });

  test('isSessionKey returns false for invalid', () => {
    expect(isSessionKey(undefined)).toBe(false);
    expect(isSessionKey({ publicKey: 'G1' })).toBe(false);
  });

  test('isValidPermission recognizes permissions', () => {
    expect(isValidPermission(0)).toBe(true);
    expect(isValidPermission(2)).toBe(true);
    expect(isValidPermission(99)).toBe(false);
    expect(isValidPermission('x')).toBe(false);
  });
});
