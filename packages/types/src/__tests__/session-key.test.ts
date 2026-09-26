import { SessionPermission, SessionKeySchema } from '../session-key';
import * as types from '../index';

describe('SessionPermission', () => {
  it('is the only SessionPermission representation exported by the package', () => {
    // Regression for the two-conflicting-enums bug: a second, bitmask-valued
    // `SessionPermission*` enum used to live in session-permission.ts, giving
    // the same concept two sources of truth with incompatible values.
    const permissionExports = Object.keys(types).filter((key) => /^SessionPermission/.test(key));
    expect(permissionExports).toEqual(['SessionPermission']);
  });

  it('uses contract permission indices, not bit flags', () => {
    // Must stay in sync with VALID_PERMISSIONS in
    // contracts/account/src/validation.rs. Bit-flag values (1, 2, 4) here would
    // silently register the wrong permissions on-chain.
    expect(SessionPermission.SEND_PAYMENT).toBe(0);
    expect(SessionPermission.MANAGE_DATA).toBe(1);
    expect(SessionPermission.INVOKE_CONTRACT).toBe(2);
  });

  it('exposes exactly the three permissions the contract accepts', () => {
    const values = Object.values(SessionPermission).filter(
      (value): value is SessionPermission => typeof value === 'number'
    );
    expect(values.sort()).toEqual([0, 1, 2]);
  });
});

describe('SessionKeySchema', () => {
  const validKey = {
    publicKey: 'G'.padEnd(56, 'A'),
    permissions: [SessionPermission.SEND_PAYMENT],
    expiresAt: 1_800_000_000_000,
  };

  it('accepts a well-formed session key', () => {
    expect(SessionKeySchema.safeParse(validKey).success).toBe(true);
  });

  it('rejects permission values outside the contract range', () => {
    // 4 is a plausible bitmask value (1 << 2) but not a valid contract index.
    const result = SessionKeySchema.safeParse({ ...validKey, permissions: [4] });
    expect(result.success).toBe(false);
  });
});
