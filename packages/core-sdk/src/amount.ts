import { InvalidAmountError } from './errors';

/**
 * Options for amount normalization and validation.
 */
export interface NormalizationOptions {
  /**
   * Maximum number of decimal places allowed.
   * Defaults to 7 (Stellar network standard).
   */
  precision?: number;

  /**
   * Minimum allowed value as a string or number.
   * Defaults to '0'.
   */
  min?: string | number;

  /**
   * Maximum allowed value as a string or number.
   * If undefined, no upper bound is enforced.
   */
  max?: string | number;

  /**
   * If true, zero is considered a valid amount.
   * Defaults to false (must be positive).
   */
  allowZero?: boolean;
}

/**
 * Normalizes and validates a numeric amount string or number.
 *
 * This utility ensures that the amount:
 * 1. Is a valid numeric format.
 * 2. Does not exceed the specified precision (max decimal places).
 * 3. Falls within the specified min/max range.
 * 4. Is returned as a clean, standardized string (no scientific notation).
 *
 * @param amount - The raw amount to normalize.
 * @param options - Validation and precision constraints.
 * @returns A normalized string representation of the amount.
 * @throws {InvalidAmountError} if the amount violates any constraints.
 */
export function normalizeAmount(
  amount: string | number,
  options: NormalizationOptions = {}
): string {
  const { precision = 7, min = '0', max, allowZero = false } = options;

  // 1. Guard against null/undefined/empty
  if (
    amount === undefined ||
    amount === null ||
    (typeof amount === 'string' && amount.trim() === '')
  ) {
    throw new InvalidAmountError('Amount is required and cannot be empty.');
  }

  // 2. Convert to string and clean up
  let strAmount = typeof amount === 'number' ? amount.toFixed(precision + 1) : amount.trim();

  // 3. Reject NaN, Infinity, and non-numeric strings
  if (
    !/^-?\d+(\.\d+)?$/.test(strAmount) ||
    isNaN(Number(strAmount)) ||
    !isFinite(Number(strAmount))
  ) {
    throw new InvalidAmountError(`Invalid amount: "${amount}". Must be a valid numeric value.`);
  }

  // 4. Split and validate precision
  const [, fractionalPart = ''] = strAmount.split('.');

  if (fractionalPart.length > precision) {
    // Only throw if the extra decimals are non-zero
    if (/[1-9]/.test(fractionalPart.substring(precision))) {
      throw new InvalidAmountError(
        `Amount exceeds maximum precision of ${precision} decimal places.`
      );
    }
  }

  // 5. Use BigInt scaling for range checks (avoids floating point issues)
  const scaledAmount = toScaledBigInt(strAmount, precision);
  const scaledMin = toScaledBigInt(String(min), precision);

  if (scaledAmount < scaledMin) {
    throw new InvalidAmountError(`Amount is below the minimum allowed value of ${min}.`);
  }

  if (max !== undefined) {
    const scaledMax = toScaledBigInt(String(max), precision);
    if (scaledAmount > scaledMax) {
      throw new InvalidAmountError(`Amount exceeds the maximum allowed value of ${max}.`);
    }
  }

  if (!allowZero && scaledAmount === 0n) {
    throw new InvalidAmountError('Amount must be greater than zero.');
  }

  // 6. Format back to standardized string
  const absScaled = scaledAmount < 0n ? -scaledAmount : scaledAmount;
  const rawStr = absScaled.toString().padStart(precision + 1, '0');

  const finalInteger = rawStr.slice(0, -precision) || '0';
  let finalFraction = rawStr.slice(-precision).replace(/0+$/, '');

  const sign = scaledAmount < 0n ? '-' : '';
  const result = finalFraction ? `${finalInteger}.${finalFraction}` : finalInteger;

  return sign + result;
}

/**
 * Internal helper to convert a numeric string to a scaled BigInt.
 * Example: toScaledBigInt("10.5", 7) -> 105000000n
 */
function toScaledBigInt(val: string, precision: number): bigint {
  const [int, frac = ''] = val.split('.');
  const paddedFrac = frac.padEnd(precision, '0').substring(0, precision);
  try {
    return BigInt(int + paddedFrac);
  } catch {
    throw new InvalidAmountError(`Failed to parse numeric value: ${val}`);
  }
}
