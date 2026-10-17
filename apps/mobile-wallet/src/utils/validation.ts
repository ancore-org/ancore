/**
 * Validation utilities for mobile wallet.
 *
 * This module provides validators for user input, ensuring data conforms to
 * Stellar-specific constraints (e.g., stroop precision for XLM amounts).
 */

/**
 * Validates a Stellar amount string for XLM payments.
 *
 * Stellar uses 7 decimal places (stroops) as the smallest unit.
 * This validator ensures:
 * - Amount is non-negative
 * - Amount has at most 7 decimal places
 * - Amount contains only valid numeric characters
 *
 * @param amountStr - The amount string to validate (e.g., "10.5", "0.0000001")
 * @returns true if the amount is valid, false otherwise
 *
 * @example
 * ```ts
 * validateStellarAmount("10") // true
 * validateStellarAmount("10.5") // true
 * validateStellarAmount("10.1234567") // true
 * validateStellarAmount("10.12345678") // false (too many decimals)
 * validateStellarAmount("-10") // false (negative)
 * validateStellarAmount("abc") // false (non-numeric)
 * ```
 */
export function validateStellarAmount(amountStr: string): boolean {
  if (!amountStr || typeof amountStr !== 'string') {
    return false;
  }

  // Regex: optional integer part, optional decimal part with max 7 digits
  // ^[0-9]+(\.[0-9]{1,7})?$
  // - Starts with one or more digits
  // - Optionally followed by a decimal point and 1-7 digits
  // - No negative sign, no spaces, no other characters
  const stellarAmountRegex = /^[0-9]+(\.[0-9]{1,7})?$/;

  return stellarAmountRegex.test(amountStr);
}

/**
 * Formats an error message for invalid Stellar amounts.
 *
 * @param amountStr - The amount string that failed validation
 * @returns A user-friendly error message
 */
export function getStellarAmountValidationError(amountStr: string): string {
  if (!amountStr) {
    return 'Amount is required';
  }

  if (amountStr.startsWith('-')) {
    return 'Negative amounts are not allowed';
  }

  // Check for non-numeric characters
  if (!/^[0-9.]+$/.test(amountStr)) {
    return 'Amount must contain only numbers and a decimal point';
  }

  // Check for multiple decimal points
  const decimalPoints = (amountStr.match(/\./g) || []).length;
  if (decimalPoints > 1) {
    return 'Amount can have at most one decimal point';
  }

  // Check decimal precision
  const decimalPart = amountStr.split('.')[1];
  if (decimalPart && decimalPart.length > 7) {
    return 'Maximum 7 decimal places allowed';
  }

  return 'Invalid amount format';
}
