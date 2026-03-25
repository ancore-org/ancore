import { describe, it, expect } from 'vitest';
import {
  isStellarAddress,
  stellarAddressSchema,
  amountSchema,
  passwordSchema,
  parseAmount,
  formatAmount,
  getPasswordStrength,
  STELLAR_ADDRESS_REGEX,
} from '@/components/Form/validation';

// ---------------------------------------------------------------------------
// isStellarAddress
// ---------------------------------------------------------------------------

describe('isStellarAddress', () => {
  const VALID_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

  it('returns true for a valid Stellar public key', () => {
    expect(isStellarAddress(VALID_ADDRESS)).toBe(true);
  });

  it('returns false for an address that does not start with G', () => {
    expect(isStellarAddress('SDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37')).toBe(
      false
    );
  });

  it('returns false for an address that is too short', () => {
    expect(isStellarAddress('GDQP2KPQGKIHYJGXNUIYOMHA')).toBe(false);
  });

  it('returns false for an address that is too long', () => {
    expect(isStellarAddress(VALID_ADDRESS + 'X')).toBe(false);
  });

  it('returns false for an address with lowercase letters', () => {
    expect(isStellarAddress(VALID_ADDRESS.toLowerCase())).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isStellarAddress('')).toBe(false);
  });

  it('returns false for an address with invalid base32 characters (0, 1)', () => {
    const withZero = 'G0QP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';
    expect(isStellarAddress(withZero)).toBe(false);
  });

  it('matches the exported regex constant', () => {
    expect(STELLAR_ADDRESS_REGEX.test(VALID_ADDRESS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stellarAddressSchema (Zod)
// ---------------------------------------------------------------------------

describe('stellarAddressSchema', () => {
  const VALID = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

  it('parses a valid address successfully', () => {
    expect(stellarAddressSchema.parse(VALID)).toBe(VALID);
  });

  it('fails for an empty string with "required" message', () => {
    const result = stellarAddressSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/required/i);
    }
  });

  it('fails for an invalid address with a descriptive message', () => {
    const result = stellarAddressSchema.safeParse('not-an-address');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/invalid stellar address/i);
    }
  });
});

// ---------------------------------------------------------------------------
// amountSchema (Zod)
// ---------------------------------------------------------------------------

describe('amountSchema', () => {
  it('accepts a positive integer string', () => {
    expect(amountSchema.parse('10')).toBe('10');
  });

  it('accepts a decimal with up to 7 places', () => {
    expect(amountSchema.parse('0.1234567')).toBe('0.1234567');
  });

  it('fails for an empty string', () => {
    const result = amountSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('fails for zero', () => {
    const result = amountSchema.safeParse('0');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/greater than zero/i);
    }
  });

  it('fails for a negative amount', () => {
    const result = amountSchema.safeParse('-5');
    expect(result.success).toBe(false);
  });

  it('fails for more than 7 decimal places', () => {
    const result = amountSchema.safeParse('0.12345678');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/decimal places/i);
    }
  });

  it('fails for non-numeric strings', () => {
    const result = amountSchema.safeParse('abc');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// passwordSchema (Zod)
// ---------------------------------------------------------------------------

describe('passwordSchema', () => {
  it('accepts a password of 8+ characters', () => {
    expect(passwordSchema.parse('SecureP@ss')).toBe('SecureP@ss');
  });

  it('fails for a password shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('short');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/8 characters/i);
    }
  });

  it('fails for a password longer than 128 characters', () => {
    const result = passwordSchema.safeParse('a'.repeat(129));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/too long/i);
    }
  });
});

// ---------------------------------------------------------------------------
// parseAmount
// ---------------------------------------------------------------------------

describe('parseAmount', () => {
  it('parses a plain number string', () => {
    expect(parseAmount('123.45')).toBe(123.45);
  });

  it('strips non-numeric characters', () => {
    expect(parseAmount('$1,234.56')).toBeCloseTo(1234.56);
  });

  it('returns NaN for a fully non-numeric string', () => {
    expect(isNaN(parseAmount('abc'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatAmount
// ---------------------------------------------------------------------------

describe('formatAmount', () => {
  it('formats with default 7 decimal places and trims trailing zeros', () => {
    expect(formatAmount(10)).toBe('10');
  });

  it('preserves significant decimals', () => {
    expect(formatAmount(1.5)).toBe('1.5');
  });

  it('respects custom decimal places', () => {
    expect(formatAmount(1.123456789, 2)).toBe('1.12');
  });
});

// ---------------------------------------------------------------------------
// getPasswordStrength
// ---------------------------------------------------------------------------

describe('getPasswordStrength', () => {
  it('returns score 0 for an empty password', () => {
    const result = getPasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.label).toBe('Very Weak');
    expect(result.percent).toBe(0);
  });

  it('scores a simple 8-char lowercase password as weak (1)', () => {
    const result = getPasswordStrength('password');
    expect(result.score).toBeLessThanOrEqual(2);
  });

  it('gives a higher score for a complex password', () => {
    const result = getPasswordStrength('C0mpl3x!Pass#2024');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('gives score 4 and "Very Strong" for an ideal password', () => {
    const result = getPasswordStrength('Tr0ub4dor&3-LongerPass!');
    expect(result.score).toBe(4);
    expect(result.label).toBe('Very Strong');
    expect(result.percent).toBe(100);
  });

  it('penalises repeated characters', () => {
    const repeatResult = getPasswordStrength('aaaaaaaa');
    const normalResult = getPasswordStrength('abcdefgh');
    expect(repeatResult.score).toBeLessThanOrEqual(normalResult.score);
  });

  it('returns a colorClass and bgClass string', () => {
    const result = getPasswordStrength('Hello123!');
    expect(typeof result.colorClass).toBe('string');
    expect(result.colorClass.length).toBeGreaterThan(0);
    expect(typeof result.bgClass).toBe('string');
    expect(result.bgClass.length).toBeGreaterThan(0);
  });

  it('score is always 0–4', () => {
    const passwords = ['', 'a', 'ab12AB!@', 'Correct-Horse-Battery-Staple!9'];
    passwords.forEach((pw) => {
      const { score } = getPasswordStrength(pw);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    });
  });
});
