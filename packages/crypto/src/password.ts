/**
 * Password strength validation for the crypto + storage encryption layers.
 * Used to enforce strong passwords before PBKDF2 key derivation.
 *
 */

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordValidationResult {
  valid: boolean;
  strength: PasswordStrength;
  reasons: string[];
}

const MIN_LENGTH = 12;
const STRONG_LENGTH = 16;

/**
 * Common weak passwords / patterns that PBKDF2 cannot compensate for.
 * Stored as lowercase for case-insensitive comparison.
 */
const COMMON_WEAK_PATTERNS: RegExp[] = [
  /^(.)\1+$/, // All same character: "aaaaaa", "111111"
  /^(012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210)+$/i, // Pure numeric sequences
  /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Pure alpha sequences
  /^(password|passw0rd|p@ssword|p@ssw0rd|qwerty|letmein|welcome|admin|login|iloveyou|monkey|dragon|master|sunshine|shadow|princess|football|baseball|superman|batman)+$/i, // Common dictionary passwords
  /^[0-9]+$/, // Digits only
  /^[a-zA-Z]+$/, // Letters only — no digits or symbols
];

function hasUppercase(password: string): boolean {
  return /[A-Z]/.test(password);
}

function hasLowercase(password: string): boolean {
  return /[a-z]/.test(password);
}

function hasDigit(password: string): boolean {
  return /[0-9]/.test(password);
}

function hasSpecialChar(password: string): boolean {
  return /[^a-zA-Z0-9]/.test(password);
}

function matchesWeakPattern(password: string): boolean {
  return COMMON_WEAK_PATTERNS.some((pattern) => pattern.test(password));
}

/**
 * Validates the strength of a password.
 *
 * Strength levels:
 *   - **weak**   : Fails minimum requirements — rejected.
 *   - **medium** : Meets minimums but lacks some recommended criteria — accepted with a warning.
 *   - **strong** : Meets all recommended criteria — fully accepted.
 *
 * @param password - The plaintext password to evaluate.
 * @returns A {@link PasswordValidationResult} describing validity, strength, and reasons.
 *
 * @example
 * const result = validatePasswordStrength("MyS3cur3P@ssw0rd!");
 * if (!result.valid) throw new Error(result.reasons.join(", "));
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const reasons: string[] = [];

  if (typeof password !== 'string' || password.length === 0) {
    return {
      valid: false,
      strength: 'weak',
      reasons: ['Password must be a non-empty string.'],
    };
  }

  if (password.length < MIN_LENGTH) {
    reasons.push(`Password must be at least ${MIN_LENGTH} characters long.`);
  }

  if (!hasUppercase(password)) {
    reasons.push('Password must contain at least one uppercase letter.');
  }

  if (!hasLowercase(password)) {
    reasons.push('Password must contain at least one lowercase letter.');
  }

  if (!hasDigit(password)) {
    reasons.push('Password must contain at least one digit.');
  }

  if (!hasSpecialChar(password)) {
    reasons.push('Password must contain at least one special character.');
  }

  if (matchesWeakPattern(password)) {
    reasons.push('Password matches a commonly used or easily guessable pattern.');
  }

  if (reasons.length > 0) {
    return { valid: false, strength: 'weak', reasons };
  }

  const isLongEnough = password.length >= STRONG_LENGTH;
  const hasVariety =
    hasUppercase(password) &&
    hasLowercase(password) &&
    hasDigit(password) &&
    hasSpecialChar(password);

  if (isLongEnough && hasVariety) {
    return { valid: true, strength: 'strong', reasons: [] };
  }

  // Passes minimums but could be stronger
  const suggestions: string[] = [];
  if (!isLongEnough) {
    suggestions.push(
      `Consider using at least ${STRONG_LENGTH} characters for a stronger password.`
    );
  }

  return { valid: true, strength: 'medium', reasons: suggestions };
}
