import { validatePasswordStrength, PasswordValidationResult } from '../password';
import { describe, expect, it } from '@jest/globals';

function expectWeak(result: PasswordValidationResult) {
  expect(result.valid).toBe(false);
  expect(result.strength).toBe('weak');
  expect(result.reasons.length).toBeGreaterThan(0);
}

function expectMedium(result: PasswordValidationResult) {
  expect(result.valid).toBe(true);
  expect(result.strength).toBe('medium');
}

function expectStrong(result: PasswordValidationResult) {
  expect(result.valid).toBe(true);
  expect(result.strength).toBe('strong');
  expect(result.reasons).toHaveLength(0);
}

function assertNoPasswordLeak(password: string, result: PasswordValidationResult) {
  for (const reason of result.reasons) {
    expect(reason).not.toContain(password);
  }
}

describe('validatePasswordStrength()', () => {
  describe('input edge cases', () => {
    it('rejects an empty string', () => {
      const result = validatePasswordStrength('');
      expectWeak(result);
    });

    it('rejects a non-string value (null cast)', () => {
      // Simulates accidental misuse from JavaScript callers
      const result = validatePasswordStrength(null as unknown as string);
      expectWeak(result);
    });

    it('rejects a non-string value (number cast)', () => {
      const result = validatePasswordStrength(42 as unknown as string);
      expectWeak(result);
    });
  });

  describe('weak passwords → rejected', () => {
    it('rejects a password shorter than 12 characters', () => {
      const result = validatePasswordStrength('Short1!');
      expectWeak(result);
      expect(result.reasons.some((r) => r.toLowerCase().includes('12'))).toBe(true);
    });

    it('rejects a password with no uppercase letter', () => {
      const result = validatePasswordStrength('nouppercase1!abcde');
      expectWeak(result);
      expect(result.reasons.some((r) => r.toLowerCase().includes('uppercase'))).toBe(true);
    });

    it('rejects a password with no lowercase letter', () => {
      const result = validatePasswordStrength('NOLOWERCASE1!ABCDE');
      expectWeak(result);
      expect(result.reasons.some((r) => r.toLowerCase().includes('lowercase'))).toBe(true);
    });

    it('rejects a password with no digit', () => {
      const result = validatePasswordStrength('NoDigitsHere!AbcDef');
      expectWeak(result);
      expect(result.reasons.some((r) => r.toLowerCase().includes('digit'))).toBe(true);
    });

    it('rejects a password with no special character', () => {
      const result = validatePasswordStrength('NoSpecialChar1AbcDe');
      expectWeak(result);
      expect(result.reasons.some((r) => r.toLowerCase().includes('special'))).toBe(true);
    });

    it('rejects all-same-character passwords', () => {
      const result = validatePasswordStrength('aaaaaaaaaaaaaaaa');
      expectWeak(result);
    });

    it('rejects all-digits passwords', () => {
      const result = validatePasswordStrength('1234567890123');
      expectWeak(result);
    });

    it('rejects all-letters passwords', () => {
      const result = validatePasswordStrength('abcdefghijklmno');
      expectWeak(result);
    });

    it('rejects simple ascending numeric sequences', () => {
      const result = validatePasswordStrength('1234567890123!');
      // Fails because no uppercase + no lowercase
      expectWeak(result);
    });

    it('rejects common dictionary word "password"', () => {
      // Even padded to length it should still fail due to no special variety
      const result = validatePasswordStrength('Password123456');
      expectWeak(result);
    });

    it('rejects "qwerty" based passwords', () => {
      const result = validatePasswordStrength('qwertyQWERTY12');
      expectWeak(result);
    });

    it('rejects "admin" pattern password', () => {
      expectWeak(validatePasswordStrength('adminADMIN1234!'));
      const result2 = validatePasswordStrength('adminadminadmin1!');
      expectWeak(result2);
    });
  });

  describe('medium passwords → valid with suggestions', () => {
    it('accepts a 12-character password meeting all basic rules (medium)', () => {
      // Meets the 12-char minimum but is under 16 chars
      const result = validatePasswordStrength('Abcdef1!ghij');
      expectMedium(result);
    });

    it('includes a suggestion to increase length for medium passwords', () => {
      const result = validatePasswordStrength('Abcdef1!ghij');
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.toLowerCase().includes('16'))).toBe(true);
    });

    it('medium password has no password content in suggestions', () => {
      const pwd = 'Abcdef1!ghij';
      const result = validatePasswordStrength(pwd);
      assertNoPasswordLeak(pwd, result);
    });
  });

  describe('strong passwords → accepted', () => {
    it('accepts a 16+ character password with full variety', () => {
      const result = validatePasswordStrength('MyS3cur3P@ssw0rd!');
      expectStrong(result);
    });

    it('accepts a long passphrase with required variety', () => {
      const result = validatePasswordStrength('Correct-Battery-Staple-42!');
      expectStrong(result);
    });

    it('accepts a 20-character mixed password', () => {
      const result = validatePasswordStrength('aB3$eF6&hI9@kL2#nO5!');
      expectStrong(result);
    });

    it('accepts passwords with unicode special characters', () => {
      const result = validatePasswordStrength('Sécur1té_P@ssw0rd!XY');
      expectStrong(result);
    });

    it('returns no reasons for a strong password', () => {
      const result = validatePasswordStrength('MyS3cur3P@ssw0rd!');
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('no password content leaks into reasons', () => {
    const passwords = ['weakpass', 'Short1!', 'MyS3cur3P@ssw0rd!', 'aB3$eF6&hI9@kL2#nO5!'];

    it.each(passwords)("password '%s' does not appear in result.reasons", (pwd: string) => {
      const result = validatePasswordStrength(pwd);
      assertNoPasswordLeak(pwd, result);
    });
  });

  describe('boundary conditions', () => {
    it('rejects a password of exactly 11 characters even if otherwise valid', () => {
      const result = validatePasswordStrength('Abcde1!fGhi'); // 11 chars
      expectWeak(result);
    });

    it('accepts a password of exactly 12 characters (minimum) as at least medium', () => {
      const result = validatePasswordStrength('Abcdef1!ghIj'); // 12 chars
      expect(result.valid).toBe(true);
    });

    it('marks a password of exactly 16 characters with full variety as strong', () => {
      const result = validatePasswordStrength('Abcde1!fGhiJ2@kL'); // 16 chars
      expectStrong(result);
    });

    it('rejects a 100-character password made of repeating characters', () => {
      const result = validatePasswordStrength('a'.repeat(100));
      expectWeak(result);
    });
  });
});
