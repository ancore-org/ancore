import { z } from 'zod';

/**
 * Stellar public key regex: starts with G, followed by 55 base32 chars (A-Z2-7)
 * Total 56 characters — matches the Stellar Ed25519 public key encoding.
 */
export const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Returns true if the value is a valid Stellar public key.
 */
export function isStellarAddress(value: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(value);
}

/**
 * Zod schema for a Stellar public key address.
 */
export const stellarAddressSchema = z
  .string()
  .min(1, 'Address is required')
  .refine(isStellarAddress, {
    message: 'Invalid Stellar address. Must start with G and be 56 characters.',
  });

/**
 * Zod schema for a transaction amount.
 * Accepts decimal strings with up to 7 decimal places (Stellar precision).
 */
export const amountSchema = z
  .string()
  .min(1, 'Amount is required')
  .refine((val) => !isNaN(parseFloat(val)), { message: 'Amount must be a number' })
  .refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than zero' })
  .refine((val) => /^\d+(\.\d{1,7})?$/.test(val), {
    message: 'Too many decimal places (max 7)',
  });

/**
 * Parses an amount string to a number. Returns NaN if invalid.
 */
export function parseAmount(value: string): number {
  return parseFloat(value.replace(/[^0-9.]/g, ''));
}

/**
 * Formats a number to a Stellar-safe decimal string (up to 7 decimal places).
 */
export function formatAmount(value: number, decimals = 7): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Zod schema for a wallet password.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  /** Tailwind text-color class */
  colorClass: string;
  /** 0–100 progress bar fill */
  percent: number;
}

const STRENGTH_LABELS: PasswordStrength['label'][] = [
  'Very Weak',
  'Weak',
  'Fair',
  'Strong',
  'Very Strong',
];

const STRENGTH_COLOR_CLASSES: string[] = [
  'text-destructive',
  'text-orange-500',
  'text-yellow-500',
  'text-blue-500',
  'text-green-500',
];

const STRENGTH_BG_CLASSES: string[] = [
  'bg-destructive',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-blue-500',
  'bg-green-500',
];

/**
 * Returns a password strength score (0–4) and associated metadata.
 * Uses heuristic rules aligned with the zxcvbn score scale.
 */
export function getPasswordStrength(password: string): PasswordStrength & { bgClass: string } {
  if (!password) {
    return { score: 0, label: 'Very Weak', colorClass: STRENGTH_COLOR_CLASSES[0], bgClass: STRENGTH_BG_CLASSES[0], percent: 0 };
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Penalise trivial patterns
  if (/^(.)\1+$/.test(password)) score = Math.max(0, score - 2);
  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    score = Math.max(0, score - 1);
  }

  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;

  return {
    score: clamped,
    label: STRENGTH_LABELS[clamped],
    colorClass: STRENGTH_COLOR_CLASSES[clamped],
    bgClass: STRENGTH_BG_CLASSES[clamped],
    percent: (clamped / 4) * 100,
  };
}
